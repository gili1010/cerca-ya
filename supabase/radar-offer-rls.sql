-- Ejecutar MANUALMENTE después de schema.sql, business-rls.sql y request-rls.sql.
-- Ejecutar primero este bloque y después el segundo: el enum debe estar confirmado.
begin;
alter type public.offer_status add value if not exists 'PENDING';
commit;

begin;
-- Compatibilidad con filas reales anteriores; nunca importa localStorage.
update public.offers set status = 'PENDING' where status = 'ACTIVE';
alter table public.offers alter column status set default 'PENDING';
alter table public.offers drop constraint if exists offers_request_business_key;
create unique index if not exists offers_one_active_per_business
  on public.offers(request_id, business_id) where status in ('PENDING', 'ACCEPTED');
alter table public.offers enable row level security;

-- Sin escrituras directas: tampoco quedan los grants por columna del schema inicial.
revoke all on public.offers from public, anon, authenticated;
revoke insert (id, request_id, business_id, product_id, product_name, description, price,
  pickup_available, delivery_available, delivery_price, estimated_delivery, alternative, status, created_at),
  update (id, request_id, business_id, product_id, product_name, description, price,
  pickup_available, delivery_available, delivery_price, estimated_delivery, alternative, status, created_at)
  on public.offers from public, anon, authenticated;
grant select on public.offers to authenticated;
drop policy if exists offers_business_create on public.offers;
drop policy if exists offers_business_edit on public.offers;
drop policy if exists offers_participants_read on public.offers;
create policy offers_participants_read on public.offers for select to authenticated using (
  private.owns_business(business_id) or exists (
    select 1 from public.requests r where r.id = request_id and r.buyer_id = (select auth.uid())
  )
);

-- No se agrega SELECT comercial a requests: su RLS continúa siendo sólo del comprador.
-- Esta proyección autenticada no devuelve buyer_id, imagen, dirección ni coordenadas.
create or replace function public.read_radar(p_request_id uuid default null, p_offset integer default 0, p_limit integer default 100)
returns table (
  id uuid, title text, description text, category_id uuid, category_name text,
  needed_when public.request_needed_when, radius_km numeric, created_at timestamptz,
  expires_at timestamptz, offers_count bigint, my_offer_id uuid
) language plpgsql stable security definer set search_path = '' as $$
declare v_business uuid;
begin
  if auth.uid() is null then raise exception 'offer_auth_required' using errcode = '42501'; end if;
  select b.id into v_business from public.businesses b where b.owner_id = auth.uid() and b.active;
  if v_business is null then raise exception 'offer_business_required' using errcode = '42501'; end if;
  return query select r.id, r.title, r.description, r.category_id, c.name, r.needed_when,
    r.radius_km, r.created_at, r.expires_at,
    (select count(*) from public.offers o where o.request_id = r.id),
    (select o.id from public.offers o where o.request_id = r.id and o.business_id = v_business
      and o.status in ('PENDING', 'ACCEPTED') limit 1)
  from public.requests r join public.categories c on c.id = r.category_id
  where r.status = 'OPEN' and r.expires_at > now() and (p_request_id is null or r.id = p_request_id)
  order by r.created_at desc, r.id
  limit greatest(1, least(coalesce(p_limit,100),100)) offset greatest(0, coalesce(p_offset,0));
end;
$$;

-- Información pública del comercio, incluso si éste se desactiva después de ofertar.
-- El modo comprador exige ser dueño del pedido; el modo vendedor, de la oferta.
create or replace function public.read_offers(
  p_request_id uuid default null, p_offer_id uuid default null, p_seller boolean default false,
  p_offset integer default 0, p_limit integer default 100
) returns table (
  id uuid, request_id uuid, business_id uuid, product_id uuid, product_name text,
  description text, price numeric, pickup_available boolean, delivery_available boolean,
  delivery_price numeric, estimated_delivery text, alternative boolean, status public.offer_status,
  created_at timestamptz, business_name text, business_city text, business_whatsapp text
) language sql stable security definer set search_path = '' as $$
  select o.id, o.request_id, o.business_id, o.product_id, o.product_name, o.description, o.price,
    o.pickup_available, o.delivery_available, o.delivery_price, o.estimated_delivery, o.alternative,
    o.status, o.created_at, b.name, b.city, b.whatsapp
  from public.offers o join public.businesses b on b.id = o.business_id
  join public.requests r on r.id = o.request_id
  where auth.uid() is not null
    and ((p_seller is true and b.owner_id = auth.uid()) or (p_seller is false and r.buyer_id = auth.uid()))
    and (p_request_id is null or o.request_id = p_request_id)
    and (p_offer_id is null or o.id = p_offer_id)
  order by o.created_at desc, o.id
  limit greatest(1, least(coalesce(p_limit,100),100)) offset greatest(0, coalesce(p_offset,0));
$$;

create or replace function public.create_my_offer(
  p_request_id uuid, p_product_id uuid, p_product_name text, p_description text, p_price numeric,
  p_pickup_available boolean, p_delivery_available boolean, p_delivery_price numeric,
  p_estimated_delivery text, p_alternative boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_business public.businesses%rowtype;
  v_request public.requests%rowtype;
  v_product public.products%rowtype;
  v_offer uuid;
begin
  if auth.uid() is null then raise exception 'offer_auth_required' using errcode = '42501'; end if;
  -- El cliente nunca elige business_id. El bloqueo mantiene activo el comercio al insertar.
  select * into v_business from public.businesses b where b.owner_id = auth.uid() and b.active for share;
  if not found then raise exception 'offer_business_required' using errcode = '42501'; end if;
  -- Serializa envíos concurrentes y cierre/cancelación del pedido.
  select * into v_request from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'offer_request_unavailable' using errcode = '22023'; end if;
  if v_request.status <> 'OPEN' or v_request.expires_at <= clock_timestamp() then
    raise exception 'offer_request_unavailable' using errcode = '22023';
  end if;
  select o.id into v_offer from public.offers o where o.request_id = p_request_id
    and o.business_id = v_business.id and o.status in ('PENDING','ACCEPTED');
  -- Un reintento tras perder la respuesta recupera la misma oferta, sin duplicarla.
  if v_offer is not null then return v_offer; end if;
  if p_product_name is null or length(btrim(p_product_name)) not between 3 and 120
    or p_description is null or length(btrim(p_description)) not between 3 and 1000
    or p_price is null or not (p_price > 0 and p_price <= 9999999999.99)
    or p_delivery_price is null or not (p_delivery_price >= 0 and p_delivery_price <= 9999999999.99)
    or p_pickup_available is null or p_delivery_available is null or p_alternative is null
    or not (p_pickup_available or p_delivery_available)
    or (p_pickup_available and not v_business.pickup_enabled)
    or (p_delivery_available and not v_business.delivery_enabled)
    or p_estimated_delivery is null or length(btrim(p_estimated_delivery)) > 120
    or (p_delivery_available and length(btrim(p_estimated_delivery)) < 1)
    or (not p_delivery_available and p_delivery_price <> 0) then
    raise exception 'offer_invalid_input' using errcode = '22023';
  end if;
  if p_product_id is not null then
    select * into v_product from public.products p where p.id = p_product_id and p.business_id = v_business.id for share;
    if not found then raise exception 'offer_product_unavailable' using errcode = '22023'; end if;
    if not v_product.active or v_product.stock_quantity < 1 or v_product.stock_status = 'OUT_OF_STOCK'
      or (p_pickup_available and not v_product.pickup_enabled)
      or (p_delivery_available and not v_product.delivery_enabled) then
      raise exception 'offer_product_unavailable' using errcode = '22023';
    end if;
  end if;
  -- Revalidar el vencimiento tras posibles esperas por el bloqueo de producto.
  if v_request.expires_at <= clock_timestamp() then raise exception 'offer_request_unavailable' using errcode = '22023'; end if;
  insert into public.offers (request_id, business_id, product_id, product_name, description, price,
    pickup_available, delivery_available, delivery_price, estimated_delivery, alternative, status)
  values (p_request_id, v_business.id, p_product_id, btrim(p_product_name), btrim(p_description), p_price,
    p_pickup_available, p_delivery_available, p_delivery_price, btrim(p_estimated_delivery), p_alternative, 'PENDING')
  returning id into v_offer;
  return v_offer;
end;
$$;

create or replace function public.withdraw_my_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_offer uuid;
begin
  if auth.uid() is null then raise exception 'offer_auth_required' using errcode = '42501'; end if;
  -- Permite retirar también después del cierre/vencimiento o desactivación del comercio.
  update public.offers o set status = 'WITHDRAWN'
    where o.id = p_offer_id and o.status = 'PENDING'
      and exists (select 1 from public.businesses b where b.id = o.business_id and b.owner_id = auth.uid())
    returning o.id into v_offer;
  if v_offer is null then
    select o.id into v_offer from public.offers o join public.businesses b on b.id = o.business_id
      where o.id = p_offer_id and o.status = 'WITHDRAWN' and b.owner_id = auth.uid();
  end if;
  if v_offer is null then raise exception 'offer_unavailable' using errcode = '42501'; end if;
  return v_offer;
end;
$$;

revoke all on function public.read_radar(uuid,integer,integer) from public, anon, authenticated;
revoke all on function public.read_offers(uuid,uuid,boolean,integer,integer) from public, anon, authenticated;
revoke all on function public.create_my_offer(uuid,uuid,text,text,numeric,boolean,boolean,numeric,text,boolean) from public, anon, authenticated;
revoke all on function public.withdraw_my_offer(uuid) from public, anon, authenticated;
grant execute on function public.read_radar(uuid,integer,integer) to authenticated;
grant execute on function public.read_offers(uuid,uuid,boolean,integer,integer) to authenticated;
grant execute on function public.create_my_offer(uuid,uuid,text,text,numeric,boolean,boolean,numeric,text,boolean) to authenticated;
grant execute on function public.withdraw_my_offer(uuid) to authenticated;
-- No se modifica requests, productos, stock ni reservas. Sin Realtime ni aceptación.
commit;

-- Ejecutar MANUALMENTE una vez instaladas las etapas existentes de pedidos/Radar.
-- No repetir schema.sql, seed.sql ni las migraciones anteriores.
begin;

-- Defensa adicional: ninguna policy permisiva puede abrir las filas privadas
-- a comerciantes ajenos. El propietario conserva su lectura completa.
drop policy if exists requests_location_owner_read on public.requests;
create policy requests_location_owner_read on public.requests as restrictive
  for select to public using (buyer_id = (select auth.uid()));

-- Se elimina la firma anterior para evitar sobrecargas ambiguas en PostgREST.
-- Los argumentos opcionales mantienen compatibles las llamadas sin ubicación.
drop function if exists public.create_my_request(uuid,text,text,uuid,numeric,public.request_needed_when);
create or replace function public.create_my_request(
  p_request_id uuid, p_title text, p_description text, p_category_id uuid,
  p_radius_km numeric, p_needed_when public.request_needed_when,
  p_latitude double precision default null, p_longitude double precision default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_duration interval;
begin
  if v_user is null then raise exception 'request_auth_required' using errcode = '42501'; end if;
  perform id from public.profiles where id = v_user for update;
  if not found then raise exception 'request_profile_required' using errcode = '42501'; end if;
  -- Reintentar nunca mueve la ubicación de un pedido ya publicado.
  if exists (select 1 from public.requests where id = p_request_id and buyer_id = v_user) then return p_request_id; end if;
  if p_request_id is null or p_title is null or length(btrim(p_title)) not between 3 and 120
    or length(coalesce(p_description, '')) > 1000 or p_radius_km is null or p_radius_km not in (5,10,20,30)
    or p_needed_when is null or not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'request_invalid_input' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
    raise exception 'request_location_invalid' using errcode = '22023';
  end if;
  v_duration := case p_needed_when when 'TODAY' then interval '24 hours'
    when 'TOMORROW' then interval '48 hours' when 'THIS_WEEK' then interval '7 days'
    when 'FLEXIBLE' then interval '14 days' end;
  insert into public.requests (id, buyer_id, title, description, category_id, radius_km,
    needed_when, expires_at, latitude, longitude)
  values (p_request_id, v_user, btrim(p_title), btrim(coalesce(p_description,'')), p_category_id,
    p_radius_km, p_needed_when, now() + v_duration, p_latitude, p_longitude);
  return p_request_id;
end;
$$;
revoke all on function public.create_my_request(uuid,text,text,uuid,numeric,public.request_needed_when,double precision,double precision) from public, anon, authenticated;
grant execute on function public.create_my_request(uuid,text,text,uuid,numeric,public.request_needed_when,double precision,double precision) to authenticated;

-- Helper interno, sin lecturas ni acceso RPC del cliente. STRICT devuelve NULL
-- si falta cualquiera de las coordenadas. Distancia sin redondear, en km.
create or replace function private.request_distance_km(
  p_lat1 double precision, p_lon1 double precision,
  p_lat2 double precision, p_lon2 double precision
) returns double precision language sql immutable strict set search_path = '' as $$
  select 6371.0 * 2 * asin(sqrt(least(1.0, greatest(0.0,
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
      * power(sin(radians(p_lon2 - p_lon1) / 2), 2)
  ))));
$$;
revoke all on function private.request_distance_km(double precision,double precision,double precision,double precision) from public, anon, authenticated;

-- Cambia el tipo de retorno: DROP exacto, nunca CASCADE.
drop function if exists public.read_radar(uuid,integer,integer);
create function public.read_radar(p_request_id uuid default null, p_offset integer default 0, p_limit integer default 100)
returns table (
  id uuid, title text, description text, category_id uuid, category_name text,
  needed_when public.request_needed_when, radius_km numeric, created_at timestamptz,
  expires_at timestamptz, offers_count bigint, my_offer_id uuid, distance_km double precision
) language plpgsql stable security definer set search_path = '' as $$
declare
  v_business public.businesses%rowtype;
begin
  if auth.uid() is null then raise exception 'offer_auth_required' using errcode = '42501'; end if;
  select b.* into v_business from public.businesses b where b.owner_id = auth.uid() and b.active;
  if not found then raise exception 'offer_business_required' using errcode = '42501'; end if;
  return query
  select r.id, r.title, r.description, r.category_id, c.name, r.needed_when,
    r.radius_km, r.created_at, r.expires_at,
    (select count(*) from public.offers o where o.request_id = r.id),
    (select o.id from public.offers o where o.request_id = r.id and o.business_id = v_business.id
      and o.status in ('PENDING', 'ACCEPTED') limit 1),
    d.km
  from public.requests r join public.categories c on c.id = r.category_id
  cross join lateral (select private.request_distance_km(
    v_business.latitude, v_business.longitude, r.latitude, r.longitude) as km) d
  where r.status = 'OPEN' and r.expires_at > now()
    and (p_request_id is null or r.id = p_request_id)
    -- Sin ubicación del pedido se mantiene el comportamiento por categorías.
    -- Si el pedido sí tiene ubicación, un comercio sin coordenadas no puede
    -- comprobar el radio: se excluye también al consultar por UUID directamente.
    and ((r.latitude is null and r.longitude is null) or d.km <= r.radius_km)
  order by r.created_at desc, r.id
  limit greatest(1, least(coalesce(p_limit,100),100)) offset greatest(0, coalesce(p_offset,0));
end;
$$;
revoke all on function public.read_radar(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.read_radar(uuid,integer,integer) to authenticated;

-- El mismo límite se aplica al enviar ofertas por RPC, incluso si se conoce
-- el UUID de un pedido que no apareció en Radar. Mantiene la transacción previa.
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
  select * into v_business from public.businesses b where b.owner_id = auth.uid() and b.active for share;
  if not found then raise exception 'offer_business_required' using errcode = '42501'; end if;
  select * into v_request from public.requests r where r.id = p_request_id for update;
  if not found then raise exception 'offer_request_unavailable' using errcode = '22023'; end if;
  if v_request.status <> 'OPEN' or v_request.expires_at <= clock_timestamp() then
    raise exception 'offer_request_unavailable' using errcode = '22023';
  end if;
  if v_request.latitude is not null and (
    v_business.latitude is null or v_business.longitude is null
    or private.request_distance_km(v_business.latitude, v_business.longitude,
      v_request.latitude, v_request.longitude) > v_request.radius_km
  ) then
    raise exception 'offer_request_unavailable' using errcode = '22023';
  end if;
  select o.id into v_offer from public.offers o where o.request_id = p_request_id
    and o.business_id = v_business.id and o.status in ('PENDING','ACCEPTED');
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
  if v_request.expires_at <= clock_timestamp() then raise exception 'offer_request_unavailable' using errcode = '22023'; end if;
  insert into public.offers (request_id, business_id, product_id, product_name, description, price,
    pickup_available, delivery_available, delivery_price, estimated_delivery, alternative, status)
  values (p_request_id, v_business.id, p_product_id, btrim(p_product_name), btrim(p_description), p_price,
    p_pickup_available, p_delivery_available, p_delivery_price, btrim(p_estimated_delivery), p_alternative, 'PENDING')
  returning id into v_offer;
  return v_offer;
end;
$$;
revoke all on function public.create_my_offer(uuid,uuid,text,text,numeric,boolean,boolean,numeric,text,boolean) from public, anon, authenticated;
grant execute on function public.create_my_offer(uuid,uuid,text,text,numeric,boolean,boolean,numeric,text,boolean) to authenticated;

-- Se conserva el trigger Realtime existente: merchant-radar recibe únicamente
-- {entity: 'radar', operation: 'REFRESH'}. El cliente vuelve a leer read_radar.
-- No se tocan realtime.messages, publications, ofertas históricas ni reservas.
notify pgrst, 'reload schema';
commit;

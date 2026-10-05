-- Ejecutar manualmente DESPUÉS de product-inventory-modes.sql y business-store-slugs.sql.
-- No ejecutar migraciones históricas después: restaurarían las RPC anteriores.
-- Conserva manage_my_reservation, sus bloqueos, stock, estados, RLS y Realtime.
begin;

alter table public.businesses
  add column if not exists accepts_cash boolean not null default true,
  add column if not exists accepts_transfer boolean not null default false,
  add column if not exists transfer_alias text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.businesses'::regclass and conname='businesses_transfer_alias_length') then
    alter table public.businesses add constraint businesses_transfer_alias_length check (transfer_alias is null or length(transfer_alias)<=100);
  end if;
end $$;
grant insert(accepts_cash,accepts_transfer,transfer_alias), update(accepts_cash,accepts_transfer,transfer_alias) on public.businesses to authenticated;

-- Los datos personales NO están en public.reservations: ni SELECT directo ni sus
-- eventos de Realtime pueden revelar la dirección/contacto de una reserva pendiente.
create table if not exists private.reservation_checkout (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  customer_name text not null check(length(customer_name) between 1 and 160),
  customer_phone text not null check(customer_phone ~ '^54(9)?[1-9][0-9]{9}$'),
  delivery_address text check(delivery_address is null or length(delivery_address) between 1 and 240),
  delivery_city text check(delivery_city is null or length(delivery_city) between 1 and 120),
  delivery_reference text check(delivery_reference is null or length(delivery_reference)<=500),
  customer_notes text check(customer_notes is null or length(customer_notes)<=1000),
  payment_method text not null check(payment_method in ('CASH','TRANSFER','ARRANGE')),
  transfer_alias text,
  pickup_address text,
  pickup_city text
);
alter table private.reservation_checkout enable row level security;
revoke all on private.reservation_checkout from public,anon,authenticated;
-- Sin políticas ni grants de lectura/escritura al cliente. Sólo RPC autorizadas.


-- Misma transacción y slug permanente; sólo agrega configuración de pago.
create or replace function public.save_my_business(
  p_input jsonb,
  p_category_ids uuid[],
  p_business_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_name text := trim(p_input ->> 'name');
  v_description text := trim(coalesce(p_input ->> 'description', ''));
  v_phone text := trim(p_input ->> 'whatsapp');
  v_city text := trim(p_input ->> 'city');
  v_address text := trim(p_input ->> 'address');
  v_pickup boolean;
  v_delivery boolean;
  v_radius numeric;
  v_price numeric;
  v_minimum numeric;
  v_categories uuid[];
  v_cash boolean := true;
  v_transfer boolean := false;
  v_alias text;
  v_name_slug text;
  v_city_slug text;
  v_base_slug text;
  v_slug text;
  v_suffix bigint := 1;
  v_constraint text;
  v_has_location boolean := p_input ? 'latitude' or p_input ? 'longitude';
  v_latitude double precision;
  v_longitude double precision;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  -- Serializa altas del mismo dueño y conserva la idempotencia actual.
  perform 1 from public.profiles where id = v_user for update;
  if not found then raise exception 'PROFILE_REQUIRED' using errcode = 'P0001'; end if;

  if p_business_id is null then
    select id into v_id from public.businesses where owner_id = v_user;
    if v_id is not null then return v_id; end if;
  else
    select id into v_id from public.businesses where id = p_business_id and owner_id = v_user for update;
    if v_id is null then raise exception 'BUSINESS_NOT_OWNED' using errcode = '42501'; end if;
  end if;

  -- Conserva la ubicación cuando no viene incluida, igual que el RPC actual.
  if v_has_location then
    if jsonb_typeof(p_input -> 'latitude') is distinct from 'number'
       or jsonb_typeof(p_input -> 'longitude') is distinct from 'number' then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
    if (p_input ->> 'latitude')::numeric not between -90 and 90
       or (p_input ->> 'longitude')::numeric not between -180 and 180 then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
    v_latitude := (p_input ->> 'latitude')::double precision;
    v_longitude := (p_input ->> 'longitude')::double precision;
  end if;

  if v_name is null or length(v_name) not between 1 and 160 then raise exception 'BUSINESS_NAME_REQUIRED'; end if;
  if length(v_description) > 3000 then raise exception 'BUSINESS_DESCRIPTION_INVALID'; end if;
  if v_phone is null or v_phone !~ '^\+?[0-9 ()-]+$' then raise exception 'BUSINESS_PHONE_INVALID'; end if;
  v_phone := regexp_replace(v_phone, '[^0-9]', '', 'g');
  if length(v_phone) not between 8 and 15 then raise exception 'BUSINESS_PHONE_INVALID'; end if;
  if v_city is null or length(v_city) not between 1 and 120 then raise exception 'BUSINESS_CITY_REQUIRED'; end if;
  if v_address is null or length(v_address) not between 1 and 240 then raise exception 'BUSINESS_ADDRESS_REQUIRED'; end if;
  if jsonb_typeof(p_input -> 'pickup_enabled') is distinct from 'boolean'
     or jsonb_typeof(p_input -> 'delivery_enabled') is distinct from 'boolean' then raise exception 'BUSINESS_DELIVERY_INVALID'; end if;
  v_pickup := (p_input ->> 'pickup_enabled')::boolean;
  v_delivery := (p_input ->> 'delivery_enabled')::boolean;
  if not v_pickup and not v_delivery then raise exception 'BUSINESS_METHOD_REQUIRED'; end if;
  if jsonb_typeof(p_input -> 'minimum_order') is distinct from 'number' then raise exception 'BUSINESS_PRICE_INVALID'; end if;
  v_minimum := (p_input ->> 'minimum_order')::numeric;
  if v_minimum not between 0 and 9999999999.99 or v_minimum <> round(v_minimum, 2) then raise exception 'BUSINESS_PRICE_INVALID'; end if;
  if v_delivery then
    if jsonb_typeof(p_input -> 'delivery_radius_km') is distinct from 'number'
       or jsonb_typeof(p_input -> 'delivery_price') is distinct from 'number' then raise exception 'BUSINESS_DELIVERY_INVALID'; end if;
    v_radius := (p_input ->> 'delivery_radius_km')::numeric;
    v_price := (p_input ->> 'delivery_price')::numeric;
    if v_radius not in (5, 10, 15, 20, 30) then raise exception 'BUSINESS_RADIUS_INVALID'; end if;
    if v_price not between 0 and 9999999999.99 or v_price <> round(v_price, 2) then raise exception 'BUSINESS_PRICE_INVALID'; end if;
  else
    v_radius := 0;
    v_price := 0;
  end if;

  if (p_input ? 'accepts_cash' and jsonb_typeof(p_input->'accepts_cash') is distinct from 'boolean')
    or (p_input ? 'accepts_transfer' and jsonb_typeof(p_input->'accepts_transfer') is distinct from 'boolean')
    or (p_input ? 'transfer_alias' and coalesce(jsonb_typeof(p_input->'transfer_alias'),'null') not in ('string','null')) then
    raise exception 'BUSINESS_PAYMENT_INVALID';
  end if;
  v_cash := coalesce((p_input->>'accepts_cash')::boolean,true);
  v_transfer := coalesce((p_input->>'accepts_transfer')::boolean,false);
  v_alias := nullif(btrim(p_input->>'transfer_alias'),'');
  if length(v_alias)>100 then raise exception 'BUSINESS_PAYMENT_INVALID'; end if;
  select array_agg(distinct category_id) into v_categories from unnest(p_category_ids) as chosen(category_id);
  if coalesce(cardinality(v_categories), 0) = 0 or array_position(v_categories, null) is not null then raise exception 'BUSINESS_CATEGORY_REQUIRED'; end if;
  if (select count(*) from public.categories where id = any(v_categories)) <> cardinality(v_categories) then raise exception 'BUSINESS_CATEGORY_INVALID'; end if;

  if p_business_id is null then
    -- NFKD permite quitar tildes compuestas y combinantes sin instalar extensiones.
    v_name_slug := trim(both '-' from regexp_replace(
      regexp_replace(lower(normalize(v_name, NFKD)), U&'[\0300-\036f]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'));
    v_city_slug := trim(both '-' from regexp_replace(
      regexp_replace(lower(normalize(v_city, NFKD)), U&'[\0300-\036f]', '', 'g'),
      '[^a-z0-9]+', '-', 'g'));
    if v_name_slug = '' then v_name_slug := 'comercio'; end if;
    if v_city_slug = '' then v_city_slug := 'localidad'; end if;
    v_base_slug := v_name_slug || '-' || v_city_slug;

    loop
      v_slug := v_base_slug || case when v_suffix = 1 then '' else '-' || v_suffix::text end;
      begin
        insert into public.businesses (owner_id, name, slug, description, whatsapp, city, address,
          pickup_enabled, delivery_enabled, delivery_radius_km, delivery_price, minimum_order, latitude, longitude, accepts_cash, accepts_transfer, transfer_alias)
        values (v_user, v_name, v_slug, v_description, v_phone, v_city, v_address,
          v_pickup, v_delivery, v_radius, v_price, v_minimum, v_latitude, v_longitude, v_cash, v_transfer, v_alias)
        -- El índice UNIQUE arbitra incluso contra comercios inactivos u ocultos por RLS.
        -- Dos altas simultáneas no pueden reservar el mismo slug.
        on conflict (slug) do nothing
        returning id into v_id;
        if v_id is not null then exit; end if;
      exception when unique_violation then
        -- No tratar otros errores de unicidad como una colisión de slug.
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'businesses_one_per_owner_idx' then
          select id into v_id from public.businesses where owner_id = v_user;
          if v_id is not null then return v_id; end if;
          raise;
        elsif v_constraint is distinct from 'businesses_slug_key' then
          raise;
        end if;
        -- También reintenta una violación explícita del UNIQUE de slug.
      end;
      v_suffix := v_suffix + 1;
    end loop;
  else
    update public.businesses set name = v_name, description = v_description, whatsapp = v_phone,
      city = v_city, address = v_address, pickup_enabled = v_pickup, delivery_enabled = v_delivery,
      delivery_radius_km = v_radius, delivery_price = v_price, minimum_order = v_minimum,
      accepts_cash = case when p_input ? 'accepts_cash' then v_cash else accepts_cash end,
      accepts_transfer = case when p_input ? 'accepts_transfer' then v_transfer else accepts_transfer end,
      transfer_alias = case when p_input ? 'transfer_alias' then v_alias else transfer_alias end,
      latitude = case when v_has_location then v_latitude else latitude end,
      longitude = case when v_has_location then v_longitude else longitude end
    where id = v_id and owner_id = v_user;
    -- El slug original nunca se recalcula durante una edición.
  end if;

  delete from public.business_categories where business_id = v_id;
  insert into public.business_categories (business_id, category_id)
    select v_id, category_id from unnest(v_categories) as chosen(category_id);
  return v_id;
end;
$$;

-- Reemplaza la firma anterior (sin dejar un overload que omita el checkout).
drop function if exists public.create_my_reservation(uuid,uuid,integer,public.delivery_type);
create or replace function public.create_my_reservation(
  p_reservation_id uuid, p_product_id uuid, p_quantity integer,
  p_delivery_type public.delivery_type, p_checkout jsonb default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_product public.products%rowtype; v_business public.businesses%rowtype;
  v_existing public.reservations%rowtype; v_snapshot private.reservation_checkout%rowtype;
  v_business_id uuid; v_now timestamptz; v_key text; v_phone text; v_checkout jsonb;
begin
  if v_user is null then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  -- Conserva serialización por comprador e idempotencia ante respuestas perdidas.
  perform id from public.profiles where id=v_user for update;
  if not found then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  if p_reservation_id is null or p_quantity is null or p_quantity<1 or p_delivery_type is null then
    raise exception 'reservation_invalid_input' using errcode='22023';
  end if;
  select * into v_existing from public.reservations where id=p_reservation_id and buyer_id=v_user;
  if v_existing.id is not null then
    if v_existing.product_id is distinct from p_product_id or v_existing.quantity is distinct from p_quantity
      or v_existing.delivery_type is distinct from p_delivery_type then
      raise exception 'reservation_retry_mismatch' using errcode='22023';
    end if;
    select * into v_snapshot from private.reservation_checkout where reservation_id=v_existing.id;
    -- Reintento compatible de una reserva histórica: no inventa datos ni la modifica.
    if v_snapshot.reservation_id is null and p_checkout is null then return v_existing.id; end if;
  end if;
  if jsonb_typeof(p_checkout) is distinct from 'object'
    or (p_checkout-array['customer_name','customer_phone','delivery_address','delivery_city','delivery_reference','customer_notes','payment_method'])<>'{}'::jsonb then
    raise exception 'reservation_checkout_invalid' using errcode='22023';
  end if;
  foreach v_key in array array['customer_name','customer_phone','payment_method'] loop
    if jsonb_typeof(p_checkout->v_key) is distinct from 'string' then
      raise exception 'reservation_checkout_invalid' using errcode='22023';
    end if;
  end loop;
  foreach v_key in array array['delivery_address','delivery_city','delivery_reference','customer_notes'] loop
    if coalesce(jsonb_typeof(p_checkout->v_key),'null') not in ('string','null') then
      raise exception 'reservation_checkout_invalid' using errcode='22023';
    end if;
  end loop;
  if length(btrim(p_checkout->>'customer_name')) not between 1 and 160
    or length(p_checkout->>'customer_phone')>40
    or (p_checkout->>'customer_phone') !~ '^\+?[0-9 ()-]+$'
    or (p_checkout->>'payment_method') not in ('CASH','TRANSFER','ARRANGE')
    or length(btrim(coalesce(p_checkout->>'delivery_address','')))>240
    or length(btrim(coalesce(p_checkout->>'delivery_city','')))>120
    or length(btrim(coalesce(p_checkout->>'delivery_reference','')))>500
    or length(btrim(coalesce(p_checkout->>'customer_notes','')))>1000 then
    raise exception 'reservation_checkout_invalid' using errcode='22023';
  end if;
  v_phone := regexp_replace(p_checkout->>'customer_phone','[^0-9]','','g');
  if left(v_phone,2)='00' then v_phone:=substr(v_phone,3); end if;
  if left(p_checkout->>'customer_phone',1)='+' and left(v_phone,2)<>'54' then
    raise exception 'reservation_checkout_phone_invalid' using errcode='22023';
  end if;
  if length(v_phone)=11 and left(v_phone,1)='0' then v_phone:=substr(v_phone,2); end if;
  if length(v_phone)=10 then v_phone:='54'||v_phone; end if;
  if v_phone !~ '^54(9)?[1-9][0-9]{9}$' then
    raise exception 'reservation_checkout_phone_invalid' using errcode='22023';
  end if;
  if p_delivery_type='DELIVERY' and (
    length(btrim(coalesce(p_checkout->>'delivery_address',''))) not between 1 and 240
    or length(btrim(coalesce(p_checkout->>'delivery_city',''))) not between 1 and 120
  ) then raise exception 'reservation_checkout_address_required' using errcode='22023'; end if;
  v_checkout := jsonb_build_object(
    'customer_name',btrim(p_checkout->>'customer_name'), 'customer_phone',v_phone,
    'payment_method',p_checkout->>'payment_method',
    'delivery_address',case when p_delivery_type='DELIVERY' then btrim(p_checkout->>'delivery_address') end,
    'delivery_city',case when p_delivery_type='DELIVERY' then btrim(p_checkout->>'delivery_city') end,
    'delivery_reference',case when p_delivery_type='DELIVERY' then nullif(btrim(p_checkout->>'delivery_reference'),'') end,
    'customer_notes',nullif(btrim(p_checkout->>'customer_notes'),'')
  );
  if v_existing.id is not null then
    if v_snapshot.reservation_id is null or
      (to_jsonb(v_snapshot)-array['reservation_id','transfer_alias','pickup_address','pickup_city']) is distinct from v_checkout then
      raise exception 'reservation_retry_mismatch' using errcode='22023';
    end if;
    return v_existing.id;
  end if;

  select business_id into v_business_id from public.products where id=p_product_id;
  if not found then raise exception 'reservation_product_unavailable' using errcode='22023'; end if;
  -- Mismos bloqueos y orden que la creación anterior: comercio, luego producto.
  select * into v_business from public.businesses where id=v_business_id for share;
  select * into v_product from public.products where id=p_product_id for share;
  if v_product.id is null or v_business.id is null or not v_product.active or not v_business.active then
    raise exception 'reservation_product_unavailable' using errcode='22023';
  end if;
  if v_product.inventory_mode='ON_DEMAND' then
    if not v_product.available_today then raise exception 'reservation_availability_unavailable' using errcode='22023'; end if;
  elsif v_product.stock_quantity<p_quantity then
    raise exception 'reservation_stock_insufficient' using errcode='22023';
  end if;
  if (p_delivery_type='PICKUP' and not (v_product.pickup_enabled and v_business.pickup_enabled))
    or (p_delivery_type='DELIVERY' and not (v_product.delivery_enabled and v_business.delivery_enabled)) then
    raise exception 'reservation_delivery_unavailable' using errcode='22023';
  end if;
  if ((v_checkout->>'payment_method')='CASH' and not v_business.accepts_cash)
    or ((v_checkout->>'payment_method')='TRANSFER' and not v_business.accepts_transfer) then
    raise exception 'reservation_payment_unavailable' using errcode='22023';
  end if;
  v_now := clock_timestamp();
  insert into public.reservations(id,buyer_id,business_id,product_id,quantity,unit_price,delivery_price,delivery_type,status,created_at,expires_at,inventory_mode)
  values(p_reservation_id,v_user,v_product.business_id,v_product.id,p_quantity,v_product.price,
    case when p_delivery_type='DELIVERY' then v_business.delivery_price else 0 end,p_delivery_type,'PENDING',v_now,v_now+interval '30 minutes',v_product.inventory_mode);
  insert into private.reservation_checkout(reservation_id,customer_name,customer_phone,delivery_address,delivery_city,delivery_reference,customer_notes,payment_method,transfer_alias,pickup_address,pickup_city)
  values(p_reservation_id,v_checkout->>'customer_name',v_phone,v_checkout->>'delivery_address',v_checkout->>'delivery_city',
    v_checkout->>'delivery_reference',v_checkout->>'customer_notes',v_checkout->>'payment_method',
    case when (v_checkout->>'payment_method')='TRANSFER' then v_business.transfer_alias end,v_business.address,v_business.city);
  -- Ambas inserciones son una sola transacción. El perfil no se modifica.
  -- No se descuenta stock al crear; manage_my_reservation sigue intacta.
  return p_reservation_id;
end;
$$;

-- Nueva proyección, mismas firmas de lectura y permisos por comprador/comercio.
drop function public.read_my_reservations(boolean,uuid,integer,integer);
create function public.read_my_reservations(p_seller boolean default false,p_reservation_id uuid default null,p_offset integer default 0,p_limit integer default 100)
returns table(id uuid,business_id uuid,product_id uuid,quantity integer,unit_price numeric,delivery_price numeric,total numeric,
  delivery_type public.delivery_type,status public.reservation_status,created_at timestamptz,expires_at timestamptz,
  confirmed_at timestamptz,ready_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,
  product_name text,business_name text,product_image text,current_stock integer,inventory_mode text,
  customer_name text,customer_phone text,delivery_address text,delivery_city text,delivery_reference text,
  customer_notes text,payment_method text,transfer_alias text,pickup_address text,pickup_city text)
language sql stable security definer set search_path = '' as $$
  select r.id,r.business_id,r.product_id,r.quantity,r.unit_price,r.delivery_price,r.total,r.delivery_type,r.status,
    r.created_at,r.expires_at,r.confirmed_at,r.ready_at,r.completed_at,r.cancelled_at,p.name,b.name,
    (select i.url from public.product_images i where i.product_id=p.id order by i.position,i.id limit 1),p.stock_quantity,r.inventory_mode,
    x.customer_name,
    case when not p_seller or visibility.released then x.customer_phone end,
    case when not p_seller or visibility.released then x.delivery_address end,
    x.delivery_city,
    case when not p_seller or visibility.released then x.delivery_reference end,
    case when not p_seller or visibility.released then x.customer_notes end,
    x.payment_method,
    case when visibility.released and x.payment_method='TRANSFER' then x.transfer_alias end,
    coalesce(x.pickup_address,b.address),coalesce(x.pickup_city,b.city)
  from public.reservations r join public.products p on p.id=r.product_id join public.businesses b on b.id=r.business_id
  left join private.reservation_checkout x on x.reservation_id=r.id
  cross join lateral (select r.confirmed_at is not null and r.status in ('CONFIRMED','READY','COMPLETED') as released) visibility
  where auth.uid() is not null and ((p_seller is true and b.owner_id=auth.uid()) or (p_seller is false and r.buyer_id=auth.uid()))
    and (p_reservation_id is null or r.id=p_reservation_id)
  order by r.created_at desc,r.id limit greatest(1,least(coalesce(p_limit,100),100)) offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.save_my_business(jsonb,uuid[],uuid) from public,anon;
grant execute on function public.save_my_business(jsonb,uuid[],uuid) to authenticated;
revoke all on function public.create_my_reservation(uuid,uuid,integer,public.delivery_type,jsonb) from public,anon,authenticated;
grant execute on function public.create_my_reservation(uuid,uuid,integer,public.delivery_type,jsonb) to authenticated;
revoke all on function public.read_my_reservations(boolean,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.read_my_reservations(boolean,uuid,integer,integer) to authenticated;

notify pgrst,'reload schema';
commit;

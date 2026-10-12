-- Aplicar MANUALMENTE después de hyperlocal-marketplace.sql y las etapas vigentes de comercio.
-- No corrige filas automáticamente. Provincia NULL identifica localidad histórica sin canonizar.
begin;
alter table public.businesses
  add column if not exists province text,
  add column if not exists province_code text,
  add column if not exists country_code text not null default 'AR',
  add column if not exists location_precision text not null default 'LEGACY';

create or replace function private.argentina_province_name(p_code text)
returns text language sql immutable set search_path='' as $$
  select case p_code
    when 'AR-B' then 'Buenos Aires'
    when 'AR-C' then 'Ciudad Autónoma de Buenos Aires'
    when 'AR-K' then 'Catamarca'
    when 'AR-H' then 'Chaco'
    when 'AR-U' then 'Chubut'
    when 'AR-X' then 'Córdoba'
    when 'AR-W' then 'Corrientes'
    when 'AR-E' then 'Entre Ríos'
    when 'AR-P' then 'Formosa'
    when 'AR-Y' then 'Jujuy'
    when 'AR-L' then 'La Pampa'
    when 'AR-F' then 'La Rioja'
    when 'AR-M' then 'Mendoza'
    when 'AR-N' then 'Misiones'
    when 'AR-Q' then 'Neuquén'
    when 'AR-R' then 'Río Negro'
    when 'AR-A' then 'Salta'
    when 'AR-J' then 'San Juan'
    when 'AR-D' then 'San Luis'
    when 'AR-Z' then 'Santa Cruz'
    when 'AR-S' then 'Santa Fe'
    when 'AR-G' then 'Santiago del Estero'
    when 'AR-T' then 'Tucumán'
    when 'AR-V' then 'Tierra del Fuego'
    else null end;
$$;
revoke all on function private.argentina_province_name(text) from public,anon,authenticated;
grant execute on function private.argentina_province_name(text) to authenticated;

create or replace function private.validate_business_canonical_location() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_province text;
begin
  if new.country_code is distinct from 'AR' then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
  if (new.latitude is null) <> (new.longitude is null)
    or (new.latitude is not null and not (new.latitude between -90 and 90 and new.longitude between -180 and 180)) then
    raise exception 'BUSINESS_LOCATION_INVALID';
  end if;
  if new.province_code is null then
    -- Falla del proveedor: permite editar otros datos conservando exactamente la ubicación legacy.
    if tg_op='INSERT' then raise exception 'BUSINESS_CANONICAL_LOCATION_REQUIRED'; end if;
    if old.province_code is not null or new.city is distinct from old.city
      or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude
      or new.province is not null or new.location_precision is distinct from old.location_precision then
      raise exception 'BUSINESS_CANONICAL_LOCATION_REQUIRED';
    end if;
    return new;
  end if;
  v_province := private.argentina_province_name(new.province_code);
  if v_province is null or new.province is distinct from v_province then raise exception 'BUSINESS_PROVINCE_INVALID'; end if;
  if new.city is null or length(btrim(new.city)) not between 1 and 120 or new.city ~ '[[:cntrl:]]' then
    raise exception 'BUSINESS_CANONICAL_LOCATION_REQUIRED';
  end if;
  new.city := btrim(regexp_replace(new.city,'[[:space:]]+',' ','g'));
  if new.location_precision not in ('LEGACY','DEVICE','NONE') or new.location_precision is null
    or (new.latitude is null and new.location_precision<>'NONE')
    or (new.latitude is not null and new.location_precision='NONE') then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
  return new;
end;
$$;
revoke all on function private.validate_business_canonical_location() from public,anon,authenticated;
drop trigger if exists businesses_canonical_location on public.businesses;
create trigger businesses_canonical_location before insert or update of city,province,province_code,country_code,location_precision,latitude,longitude
on public.businesses for each row execute function private.validate_business_canonical_location();
grant insert(province,province_code,country_code,location_precision),update(province,province_code,country_code,location_precision) on public.businesses to authenticated;

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
  v_geo boolean := p_input ? 'province_code';
  v_province_code text := p_input->>'province_code';
  v_province text := p_input->>'province';
  v_country text := coalesce(p_input->>'country_code','AR');
  v_precision text := coalesce(p_input->>'location_precision','LEGACY');
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
    if (p_input->'latitude' = 'null'::jsonb and p_input->'longitude' = 'null'::jsonb) then
      if v_precision <> 'NONE' then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
    elsif jsonb_typeof(p_input -> 'latitude') is distinct from 'number'
       or jsonb_typeof(p_input -> 'longitude') is distinct from 'number' then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
    if (p_input ->> 'latitude')::numeric not between -90 and 90
       or (p_input ->> 'longitude')::numeric not between -180 and 180 then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
    v_latitude := (p_input ->> 'latitude')::double precision;
    v_longitude := (p_input ->> 'longitude')::double precision;
  end if;

  if v_geo then
    if jsonb_typeof(p_input->'province_code') not in ('string','null')
      or jsonb_typeof(p_input->'province') not in ('string','null')
      or jsonb_typeof(p_input->'country_code') is distinct from 'string'
      or jsonb_typeof(p_input->'location_precision') is distinct from 'string' then
      raise exception 'BUSINESS_PROVINCE_INVALID';
    end if;
    if v_province_code is not null and (private.argentina_province_name(v_province_code) is null
      or v_province is distinct from private.argentina_province_name(v_province_code)) then raise exception 'BUSINESS_PROVINCE_INVALID'; end if;
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
          pickup_enabled, delivery_enabled, delivery_radius_km, delivery_price, minimum_order, latitude, longitude, accepts_cash, accepts_transfer, transfer_alias, province, province_code, country_code, location_precision)
        values (v_user, v_name, v_slug, v_description, v_phone, v_city, v_address,
          v_pickup, v_delivery, v_radius, v_price, v_minimum, v_latitude, v_longitude, v_cash, v_transfer, v_alias, v_province, v_province_code, v_country, case when v_latitude is null then 'NONE' else v_precision end)
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
      province = case when v_geo then v_province else province end,
      province_code = case when v_geo then v_province_code else province_code end,
      country_code = case when v_geo then v_country else country_code end,
      location_precision = case when v_geo then v_precision else location_precision end,
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

-- Firmas exactas anteriores: no dejar un overload que permita fallback sólo por city.
drop function if exists public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text);
drop function if exists public.search_public_stores(text,boolean,double precision,double precision,numeric,text);
create or replace function public.read_marketplace_page(
  p_query text default '', p_category text default '', p_filters text[] default '{}',
  p_sort text default 'recommended', p_home boolean default false,
  p_favorite_ids uuid[] default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_offset integer default 0, p_limit integer default 12,
  p_radius_km numeric default 20, p_locality text default null, p_province_code text default null
) returns table(product_ids uuid[], total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := private.normalize_search_query(coalesce(p_query,''));
  v_filters text[] := coalesce(p_filters,'{}');
  v_sort text := coalesce(p_sort,'recommended');
  v_home boolean;
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_limit integer;
  v_radius numeric := coalesce(p_radius_km,20);
  v_locality text := private.normalize_search_query(coalesce(p_locality,''));
begin
  if v_radius not in (5,10,20,50) or (p_province_code is not null and private.argentina_province_name(p_province_code) is null) or length(v_locality)>160 or length(v_query)>160 or length(coalesce(p_category,''))>160
    or v_sort not in ('recommended','distance','price')
    or not (v_filters <@ array['today','nearby','delivery','pickup','confirmed']::text[])
    or array_position(v_filters,null) is not null
    or (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
    raise exception 'marketplace_invalid_input' using errcode='22023';
  end if;
  if p_latitude is null and ('nearby'=any(v_filters) or 'delivery'=any(v_filters) or v_sort='distance') then
    raise exception 'marketplace_location_required' using errcode='22023';
  end if;
  if p_latitude is null and (v_locality='' or p_province_code is null) then
    return query select '{}'::uuid[],0::bigint;
    return;
  end if;
  v_home := coalesce(p_home,false) and v_query='' and coalesce(p_category,'')=''
    and p_favorite_ids is null and v_sort='recommended';
  -- Límites impuestos en PostgreSQL, incluso si se pide un p_limit mayor.
  v_limit := greatest(1,least(coalesce(p_limit,12),case when coalesce(p_home,false) and v_query='' then 12 else 24 end));

  return query
  with candidates as (
    select p.id,p.business_id,p.price,b.delivery_radius_km,
      case when p.inventory_mode='ON_DEMAND' then p.available_today
        else p.stock_quantity>0 and p.stock_status<>'OUT_OF_STOCK' end as available,
      case when p.inventory_mode='ON_DEMAND' then p.availability_confirmed_at else p.stock_confirmed_at end as confirmed_at,
      case when b.latitude between -90 and 90 and b.longitude between -180 and 180
        then private.request_distance_km(p_latitude,p_longitude,b.latitude,b.longitude) end as distance_km,
      case when v_query='' then 0
        when private.normalize_search_query(p.name)=v_query then 0
        when starts_with(private.normalize_search_query(p.name),v_query) then 1
        when strpos(private.normalize_search_query(p.name),v_query)>0 then 2
        when strpos(private.normalize_search_query(coalesce(p.brand,'')),v_query)>0 or strpos(private.normalize_search_query(coalesce(p.model,'')),v_query)>0 then 3
        else 4 end as relevance
    from public.products p
    join public.businesses b on b.id=p.business_id
    join public.categories c on c.id=p.category_id
    -- Sólo IDs de productos y comercios activos; nunca propietarios ni datos privados.
    where p.active and b.active
      and (p_latitude is not null or (b.province_code=p_province_code and b.country_code='AR' and private.normalize_search_query(coalesce(b.city,''))=v_locality))
      and (coalesce(p_category,'')='' or c.slug=p_category)
      and (p_favorite_ids is null or p.id=any(p_favorite_ids))
      and (v_query='' or strpos(private.normalize_search_query(p.name),v_query)>0
        or strpos(private.normalize_search_query(coalesce(p.brand,'')),v_query)>0
        or strpos(private.normalize_search_query(coalesce(p.model,'')),v_query)>0
        or strpos(private.normalize_search_query(p.description),v_query)>0)
      and (not ('delivery'=any(v_filters)) or (p.delivery_enabled and b.delivery_enabled))
      and (not ('pickup'=any(v_filters)) or (p.pickup_enabled and b.pickup_enabled))
  ), filtered as (
    select * from candidates
    where (p_latitude is null or distance_km<=v_radius)
      and (not ('delivery'=any(v_filters)) or distance_km<=delivery_radius_km)
      and (not ('today'=any(v_filters)) or available)
      and (not ('confirmed'=any(v_filters)) or confirmed_at is not null)
      and (not ('nearby'=any(v_filters)) or distance_km<=5)
  ), ranked as (
    select f.*,row_number() over (partition by f.business_id order by
      case when v_sort='recommended' and v_query<>'' then f.relevance end,
      case when v_sort='recommended' then f.available end desc,
      case when v_sort='price' then f.price end,
      case when v_sort='distance' then f.distance_km end nulls last,
      case when v_sort='recommended' then f.distance_km end nulls last,
      f.confirmed_at desc nulls last,f.id) as business_position
    from filtered f
  ), ordered as (
    select r.id,row_number() over (order by
      case when v_home then r.business_position else 0 end,
      case when v_sort='recommended' and v_query<>'' then r.relevance end,
      case when v_sort='recommended' then r.available end desc,
      case when v_sort='price' then r.price end,
      case when v_sort='distance' then r.distance_km end nulls last,
      case when v_sort='recommended' then r.distance_km end nulls last,
      r.confirmed_at desc nulls last,r.id) as position
    from ranked r
  ), page as (
    select o.id,o.position from ordered o order by o.position limit v_limit offset v_offset
  )
  select coalesce((select array_agg(page.id order by page.position) from page),'{}'::uuid[]),
    (select count(*) from filtered);
end;
$$;

revoke all on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text,text) from public,anon,authenticated;
grant execute on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text,text) to anon,authenticated;


create or replace function public.search_public_stores(p_query text, p_with_distance boolean default false,
  p_latitude double precision default null, p_longitude double precision default null,
  p_radius_km numeric default 20, p_locality text default null, p_province_code text default null)
returns table(id uuid, slug text, name text, city text, logo_url text,
  pickup_enabled boolean, delivery_enabled boolean, verified boolean,
  latitude double precision, longitude double precision, business_categories jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(p_radius_km,20) not in (5,10,20,50)
    or (p_province_code is not null and private.argentina_province_name(p_province_code) is null)
    or length(coalesce(p_locality,''))>160
    or (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
    raise exception 'marketplace_invalid_input' using errcode='22023';
  end if;
  return query
  with term as (select private.normalize_search_query(left(coalesce(p_query,''),160)) as value),
  matches as (
    select b.*, t.value,
      private.normalize_search_query(b.name) as normalized_name,
      case when b.latitude between -90 and 90 and b.longitude between -180 and 180
        then private.request_distance_km(p_latitude,p_longitude,b.latitude,b.longitude) end as distance_km
    from public.businesses b cross join term t
    where b.active and t.value<>''
      and ((p_latitude is not null and b.latitude between -90 and 90 and b.longitude between -180 and 180
        and private.request_distance_km(p_latitude,p_longitude,b.latitude,b.longitude)<=coalesce(p_radius_km,20))
        or (p_latitude is null and private.normalize_search_query(coalesce(p_locality,''))<>''
          and b.province_code=p_province_code and b.country_code='AR'
          and private.normalize_search_query(coalesce(b.city,''))=private.normalize_search_query(p_locality)))
      and (strpos(private.normalize_search_query(b.name),t.value)>0
        or strpos(private.normalize_search_query(coalesce(b.description,'')),t.value)>0
        or (b.province_code is not null and (strpos(private.normalize_search_query(coalesce(b.city,'')),t.value)>0
          or strpos(private.normalize_search_query(coalesce(b.province,'')),t.value)>0))
        or exists(select 1 from public.business_categories bc join public.categories c on c.id=bc.category_id
          where bc.business_id=b.id and strpos(private.normalize_search_query(c.name),t.value)>0))
  )
  select m.id,m.slug,m.name,m.city,m.logo_url,m.pickup_enabled,m.delivery_enabled,m.verified,
    case when p_with_distance then m.latitude end,
    case when p_with_distance then m.longitude end,
    coalesce((select jsonb_agg(jsonb_build_object('category',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name,c.id)
      from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=m.id),'[]'::jsonb)
  from matches m
  order by case when m.normalized_name=m.value then 0 when starts_with(m.normalized_name,m.value) then 1
    when strpos(m.normalized_name,m.value)>0 then 2 else 3 end,m.distance_km nulls last,m.name,m.id
  limit 8;
end;
$$;
revoke all on function public.search_public_stores(text,boolean,double precision,double precision,numeric,text,text) from public,anon,authenticated;
grant execute on function public.search_public_stores(text,boolean,double precision,double precision,numeric,text,text) to anon,authenticated;


notify pgrst, 'reload schema';
commit;

-- Aplicar manualmente DESPUÉS de business-location-canonical.sql.
-- Añade ADDRESS sin modificar DEVICE/NONE/LEGACY, radio, Haversine ni datos existentes.
begin;
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
      or ((new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude)
        and not (new.latitude is null and new.longitude is null and new.location_precision='NONE'))
      or new.province is not null or (new.location_precision is distinct from old.location_precision
        and not (new.latitude is null and new.longitude is null and new.location_precision='NONE')) then
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
  if new.location_precision not in ('LEGACY','DEVICE','ADDRESS','NONE') or new.location_precision is null
    or (new.latitude is null and new.location_precision<>'NONE')
    or (new.latitude is not null and new.location_precision='NONE') then raise exception 'BUSINESS_LOCATION_INVALID'; end if;
  return new;
end;
$$;
revoke all on function private.validate_business_canonical_location() from public,anon,authenticated;
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

  if p_business_id is not null and not v_has_location
    and v_address is distinct from (select b.address from public.businesses b where b.id=v_id and b.owner_id=v_user) then
    v_has_location := true; v_latitude := null; v_longitude := null;
    v_geo := true; v_precision := 'NONE';
    select b.province,b.province_code,b.country_code into v_province,v_province_code,v_country
      from public.businesses b where b.id=v_id and b.owner_id=v_user;
  end if;
  if p_input ? 'province_code' then
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


notify pgrst, 'reload schema';
commit;

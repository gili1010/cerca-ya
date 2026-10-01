-- Run manually after schema.sql and the Auth/profile migration. No remote execution by the app.
begin;

-- NULL owners (development seeds) are deliberately exempt. If existing owners have
-- duplicates, this fails without deleting anything; resolve those records explicitly.
create unique index if not exists businesses_one_per_owner_idx
  on public.businesses(owner_id) where owner_id is not null;

-- SECURITY INVOKER: caller permissions and existing RLS apply to every statement.
-- One RPC transaction saves the business AND its category set, or rolls everything back.
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
  v_base_slug text;
  v_slug text;
  v_suffix integer := 1;
  v_constraint text;
  v_has_location boolean := p_input ? 'latitude' or p_input ? 'longitude';
  v_latitude double precision;
  v_longitude double precision;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  -- Serialize two submissions from the same owner; no advisory hash collisions.
  perform 1 from public.profiles where id = v_user for update;
  if not found then raise exception 'PROFILE_REQUIRED' using errcode = 'P0001'; end if;

  if p_business_id is null then
    select id into v_id from public.businesses where owner_id = v_user;
    if v_id is not null then return v_id; end if;
  else
    select id into v_id from public.businesses where id = p_business_id and owner_id = v_user for update;
    if v_id is null then raise exception 'BUSINESS_NOT_OWNED' using errcode = '42501'; end if;
  end if;

  -- Missing keys preserve coordinates on ordinary edits (including older clients).
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

  select array_agg(distinct category_id) into v_categories from unnest(p_category_ids) as chosen(category_id);
  if coalesce(cardinality(v_categories), 0) = 0 or array_position(v_categories, null) is not null then raise exception 'BUSINESS_CATEGORY_REQUIRED'; end if;
  if (select count(*) from public.categories where id = any(v_categories)) <> cardinality(v_categories) then raise exception 'BUSINESS_CATEGORY_INVALID'; end if;

  if p_business_id is null then
    v_base_slug := trim(both '-' from regexp_replace(
      translate(lower(left(v_name, 120)), 'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc'),
      '[^a-z0-9]+', '-', 'g'));
    if v_base_slug = '' then v_base_slug := 'comercio'; end if;
    loop
      v_slug := v_base_slug || case when v_suffix = 1 then '' when v_suffix < 100 then '-' || v_suffix::text else '-' || gen_random_uuid()::text end;
      begin
        -- Defaults set verified=false and active=true. Coordinates are optional.
        insert into public.businesses (owner_id, name, slug, description, whatsapp, city, address,
          pickup_enabled, delivery_enabled, delivery_radius_km, delivery_price, minimum_order, latitude, longitude)
        values (v_user, v_name, v_slug, v_description, v_phone, v_city, v_address,
          v_pickup, v_delivery, v_radius, v_price, v_minimum, v_latitude, v_longitude)
        returning id into v_id;
        exit;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'businesses_one_per_owner_idx' then
          select id into v_id from public.businesses where owner_id = v_user;
          if v_id is not null then return v_id; end if;
          raise;
        elsif v_constraint <> 'businesses_slug_key' then raise;
        end if;
        v_suffix := v_suffix + 1;
        if v_suffix > 105 then raise exception 'BUSINESS_SLUG_UNAVAILABLE'; end if;
      end;
    end loop;
  else
    update public.businesses set name = v_name, description = v_description, whatsapp = v_phone,
      city = v_city, address = v_address, pickup_enabled = v_pickup, delivery_enabled = v_delivery,
      delivery_radius_km = v_radius, delivery_price = v_price, minimum_order = v_minimum,
      latitude = case when v_has_location then v_latitude else latitude end,
      longitude = case when v_has_location then v_longitude else longitude end
    where id = v_id and owner_id = v_user;
    -- slug, owner_id, verified, created_at and active are intentionally preserved.
  end if;

  delete from public.business_categories where business_id = v_id;
  insert into public.business_categories (business_id, category_id)
    select v_id, category_id from unnest(v_categories) as chosen(category_id);
  return v_id;
end;
$$;

revoke all on function public.save_my_business(jsonb, uuid[], uuid) from public, anon;
grant execute on function public.save_my_business(jsonb, uuid[], uuid) to authenticated;
-- RLS, public reading of active businesses and existing column grants are unchanged.
commit;

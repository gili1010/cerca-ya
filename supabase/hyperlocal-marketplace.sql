-- Delta posterior a search-accent-normalization.sql y request-location-radar.sql.
-- Aplicar manualmente. No migra datos ni modifica disponibilidad o Analytics.
begin;
-- Retira firmas antiguas: no sobrecargas ambiguas ni catálogo nacional alternativo.
drop function if exists public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer);
drop function if exists public.search_public_stores(text,boolean);
create or replace function public.read_marketplace_page(
  p_query text default '', p_category text default '', p_filters text[] default '{}',
  p_sort text default 'recommended', p_home boolean default false,
  p_favorite_ids uuid[] default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_offset integer default 0, p_limit integer default 12,
  p_radius_km numeric default 20, p_locality text default null
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
  if v_radius not in (5,10,20,50) or length(v_locality)>160 or length(v_query)>160 or length(coalesce(p_category,''))>160
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
  if p_latitude is null and v_locality='' then
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
      and (p_latitude is not null or private.normalize_search_query(coalesce(b.city,''))=v_locality)
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

revoke all on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text) from public,anon,authenticated;
grant execute on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text) to anon,authenticated;


create or replace function public.search_public_stores(p_query text, p_with_distance boolean default false,
  p_latitude double precision default null, p_longitude double precision default null,
  p_radius_km numeric default 20, p_locality text default null)
returns table(id uuid, slug text, name text, city text, logo_url text,
  pickup_enabled boolean, delivery_enabled boolean, verified boolean,
  latitude double precision, longitude double precision, business_categories jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
  if coalesce(p_radius_km,20) not in (5,10,20,50)
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
          and private.normalize_search_query(coalesce(b.city,''))=private.normalize_search_query(p_locality)))
      and (strpos(private.normalize_search_query(b.name),t.value)>0
        or strpos(private.normalize_search_query(coalesce(b.description,'')),t.value)>0
        or strpos(private.normalize_search_query(coalesce(b.city,'')),t.value)>0
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
revoke all on function public.search_public_stores(text,boolean,double precision,double precision,numeric,text) from public,anon,authenticated;
grant execute on function public.search_public_stores(text,boolean,double precision,double precision,numeric,text) to anon,authenticated;

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
    or length(coalesce(p_description, '')) > 1000 or p_radius_km is null or p_radius_km not in (5,10,20)
    or p_needed_when is null or not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'request_invalid_input' using errcode = '22023';
  end if;
  if p_latitude is null or p_longitude is null then
    raise exception 'request_location_required' using errcode='22023';
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

create or replace function public.read_radar(p_request_id uuid default null, p_offset integer default 0, p_limit integer default 100)
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
    and ((r.latitude is null and r.longitude is null) or (r.latitude between -90 and 90 and r.longitude between -180 and 180
      and v_business.latitude between -90 and 90 and v_business.longitude between -180 and 180
      and d.km <= r.radius_km))
  order by r.created_at desc, r.id
  limit greatest(1, least(coalesce(p_limit,100),100)) offset greatest(0, coalesce(p_offset,0));
end;
$$;
revoke all on function public.read_radar(uuid,integer,integer) from public, anon, authenticated;
grant execute on function public.read_radar(uuid,integer,integer) to authenticated;


alter table public.requests alter column radius_km set default 20;

-- Defensa de INSERT directo: no depende del frontend ni de elegir la RPC.
-- Sólo pedidos nuevos: no cambia ni invalida pedidos históricos al cerrarlos.
create or replace function private.guard_new_request_location() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.latitude is null or new.longitude is null then
    raise exception 'request_location_required' using errcode='22023';
  end if;
  if not (new.latitude between -90 and 90 and new.longitude between -180 and 180)
    or new.radius_km is null or new.radius_km not in (5,10,20) then
    raise exception 'request_location_invalid' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_new_request_location() from public,anon,authenticated;
drop trigger if exists hyperlocal_request_location on public.requests;
create trigger hyperlocal_request_location before insert on public.requests
for each row execute function private.guard_new_request_location();

-- Refuerza create_my_offer sin reemplazar sus validaciones/estados/transacción.
-- La RPC existente ya bloquea el radio antes de su retorno idempotente.
create or replace function private.guard_offer_radius() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  v_request public.requests%rowtype;
  v_business public.businesses%rowtype;
begin
  select * into v_request from public.requests r where r.id=new.request_id for share;
  select * into v_business from public.businesses b where b.id=new.business_id for share;
  -- Compatibilidad únicamente para pedidos históricos sin ubicación.
  if v_request.latitude is not null or v_request.longitude is not null then
    if v_request.latitude is null or v_request.longitude is null
      or not (v_request.latitude between -90 and 90 and v_request.longitude between -180 and 180)
      or v_business.latitude is null or v_business.longitude is null
      or not (v_business.latitude between -90 and 90 and v_business.longitude between -180 and 180)
      or v_request.radius_km is null
      or private.request_distance_km(v_business.latitude,v_business.longitude,v_request.latitude,v_request.longitude)>v_request.radius_km then
      raise exception 'offer_request_unavailable' using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_offer_radius() from public,anon,authenticated;
drop trigger if exists hyperlocal_offer_radius on public.offers;
create trigger hyperlocal_offer_radius before insert on public.offers
for each row execute function private.guard_offer_radius();

notify pgrst, 'reload schema';
commit;

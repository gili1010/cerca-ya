-- Aplicar MANUALMENTE después de business-location-canonical.sql,
-- business-address-geocoding.sql, business-gps-optional-address.sql y business-analytics.sql.
-- Sólo descubrimiento público y conteos de Analytics. No altera GPS, comercios,
-- productos, Pedido Abierto, Radar, ofertas, RLS ni datos históricos.
begin;

-- Retirar las firmas exactas vigentes evita sobrecargas ambiguas en PostgREST.
-- Los argumentos nuevos tienen default para conservar llamadas sin p_group.
drop function if exists public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text,text);
drop function if exists public.search_public_stores(text,boolean,double precision,double precision,numeric,text,text);

create or replace function public.read_marketplace_page(
  p_query text default '', p_category text default '', p_filters text[] default '{}',
  p_sort text default 'recommended', p_home boolean default false,
  p_favorite_ids uuid[] default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_offset integer default 0, p_limit integer default 12,
  p_radius_km numeric default 20, p_locality text default null,
  p_province_code text default null, p_group text default 'distance'
) returns table(product_ids uuid[], total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := private.normalize_search_query(coalesce(p_query,''));
  v_filters text[] := coalesce(p_filters,'{}');
  v_sort text := coalesce(p_sort,'recommended');
  v_group text := coalesce(p_group,'distance');
  v_home boolean;
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_limit integer;
  v_radius numeric := coalesce(p_radius_km,20);
  v_locality text := private.normalize_search_query(coalesce(p_locality,''));
  v_province text := private.argentina_province_name(p_province_code);
begin
  if v_radius not in (5,10,20,50) or v_group not in ('distance','locality')
    or (p_province_code is not null and v_province is null)
    or length(v_locality)>160 or length(v_query)>160 or length(coalesce(p_category,''))>160
    or v_sort not in ('recommended','distance','price')
    or not (v_filters <@ array['today','nearby','delivery','pickup','confirmed']::text[])
    or array_position(v_filters,null) is not null
    or (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
    raise exception 'marketplace_invalid_input' using errcode='22023';
  end if;
  -- Ninguna llamada sin alcance habilita accidentalmente el catálogo nacional.
  if (v_group='distance' and p_latitude is null)
    or (v_group='locality' and (v_locality='' or v_province is null))
    -- Localidad no demuestra ni cercanía <5 km ni cobertura de envío.
    or (v_group='locality' and ('nearby'=any(v_filters) or 'delivery'=any(v_filters))) then
    return query select '{}'::uuid[],0::bigint;
    return;
  end if;
  -- Ordenar por distancia en el grupo sin distancia usa el orden recomendado.
  if v_group='locality' and v_sort='distance' then v_sort := 'recommended'; end if;
  v_home := coalesce(p_home,false) and v_query='' and coalesce(p_category,'')=''
    and p_favorite_ids is null and v_sort='recommended';
  v_limit := greatest(1,least(coalesce(p_limit,12),case when coalesce(p_home,false) and v_query='' then 12 else 24 end));

  return query
  with candidates as (
    select p.id,p.business_id,p.price,b.delivery_radius_km,
      case when p.inventory_mode='ON_DEMAND' then p.available_today
        else p.stock_quantity>0 and p.stock_status<>'OUT_OF_STOCK' end as available,
      case when p.inventory_mode='ON_DEMAND' then p.availability_confirmed_at else p.stock_confirmed_at end as confirmed_at,
      -- No calcular ni rankear por distancia en coincidencias de localidad.
      case when v_group='distance' and b.latitude between -90 and 90 and b.longitude between -180 and 180
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
    where p.active and p.admin_blocked_at is null
      and b.active and b.admin_suspended_at is null and b.country_code='AR'
      and (
        (v_group='distance' and b.latitude between -90 and 90 and b.longitude between -180 and 180)
        or (v_group='locality'
          and b.province_code=p_province_code and b.province=v_province
          and private.normalize_search_query(coalesce(b.city,''))=v_locality
          and (
            -- Con GPS comprador sólo se incluyen comercios sin ambos puntos.
            -- Un comercio con GPS lejano nunca puede volver por coincidencia textual.
            (b.latitude is null and b.longitude is null)
            -- Sin GPS comprador se explora la localidad completa, sin afirmar km.
            or (p_latitude is null and b.latitude between -90 and 90 and b.longitude between -180 and 180)
          ))
      )
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
    where (v_group='locality' or distance_km<=v_radius)
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
revoke all on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer,numeric,text,text,text) to anon,authenticated;

create or replace function public.search_public_stores(
  p_query text, p_with_distance boolean default false,
  p_latitude double precision default null, p_longitude double precision default null,
  p_radius_km numeric default 20, p_locality text default null,
  p_province_code text default null, p_group text default 'distance'
) returns table(id uuid, slug text, name text, city text, logo_url text,
  pickup_enabled boolean, delivery_enabled boolean, verified boolean,
  latitude double precision, longitude double precision, business_categories jsonb)
language plpgsql stable security definer set search_path='' as $$
declare
  v_group text := coalesce(p_group,'distance');
  v_radius numeric := coalesce(p_radius_km,20);
  v_locality text := private.normalize_search_query(coalesce(p_locality,''));
  v_province text := private.argentina_province_name(p_province_code);
begin
  if v_radius not in (5,10,20,50) or v_group not in ('distance','locality')
    or (p_province_code is not null and v_province is null)
    or length(coalesce(p_locality,''))>160
    or (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
    raise exception 'marketplace_invalid_input' using errcode='22023';
  end if;
  if (v_group='distance' and p_latitude is null)
    or (v_group='locality' and (v_locality='' or v_province is null)) then return; end if;

  return query
  with term as (select private.normalize_search_query(left(coalesce(p_query,''),160)) as value),
  matches as (
    select b.id,b.slug,b.name,b.city,b.logo_url,b.pickup_enabled,b.delivery_enabled,b.verified,b.latitude,b.longitude,t.value,
      private.normalize_search_query(b.name) as normalized_name,
      case when v_group='distance' and b.latitude between -90 and 90 and b.longitude between -180 and 180
        then private.request_distance_km(p_latitude,p_longitude,b.latitude,b.longitude) end as distance_km
    from public.businesses b cross join term t
    where b.active and b.admin_suspended_at is null and b.country_code='AR' and t.value<>''
      and (
        (v_group='distance' and b.latitude between -90 and 90 and b.longitude between -180 and 180
          and private.request_distance_km(p_latitude,p_longitude,b.latitude,b.longitude)<=v_radius)
        or (v_group='locality' and b.province_code=p_province_code and b.province=v_province
          and private.normalize_search_query(coalesce(b.city,''))=v_locality
          and ((b.latitude is null and b.longitude is null)
            or (p_latitude is null and b.latitude between -90 and 90 and b.longitude between -180 and 180)))
      )
      and (strpos(private.normalize_search_query(b.name),t.value)>0
        or strpos(private.normalize_search_query(coalesce(b.description,'')),t.value)>0
        or (b.province_code is not null and (strpos(private.normalize_search_query(coalesce(b.city,'')),t.value)>0
          or strpos(private.normalize_search_query(coalesce(b.province,'')),t.value)>0))
        or exists(select 1 from public.business_categories bc join public.categories c on c.id=bc.category_id
          where bc.business_id=b.id and strpos(private.normalize_search_query(c.name),t.value)>0))
  )
  select m.id,m.slug,m.name,m.city,m.logo_url,m.pickup_enabled,m.delivery_enabled,m.verified,
    -- Preserva la proyección anterior. Localidad nunca entrega un punto para calcular km.
    case when v_group='distance' and p_with_distance then m.latitude end,
    case when v_group='distance' and p_with_distance then m.longitude end,
    coalesce((select jsonb_agg(jsonb_build_object('category',jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug)) order by c.name,c.id)
      from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=m.id),'[]'::jsonb)
  from matches m
  order by case when m.normalized_name=m.value then 0 when starts_with(m.normalized_name,m.value) then 1
    when strpos(m.normalized_name,m.value)>0 then 2 else 3 end,m.distance_km nulls last,m.name,m.id
  limit 8;
end;
$$;
revoke all on function public.search_public_stores(text,boolean,double precision,double precision,numeric,text,text,text) from public,anon,authenticated;
grant execute on function public.search_public_stores(text,boolean,double precision,double precision,numeric,text,text,text) to anon,authenticated;

-- Eventos anteriores conservan ambos nuevos conteos NULL: no se infiere un
-- desglose que nunca se midió. results_count mantiene su significado agregado
-- para que admin_search_analytics y has_results sigan funcionando sin cambios.
alter table public.search_events
  add column if not exists distance_results_count integer check (distance_results_count between 0 and 1000000),
  add column if not exists locality_results_count integer check (locality_results_count between 0 and 1000000);
drop function if exists public.record_search_event(uuid,text,integer,uuid,text);
create or replace function public.record_search_event(
  p_id uuid, p_query text, p_results_count integer,
  p_category_id uuid default null, p_locality text default null,
  p_distance_count integer default null, p_locality_count integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare
  v_query text := btrim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g'));
  v_locality text := nullif(btrim(p_locality),'');
begin
  if p_id is null or length(v_query) not between 2 and 120
    or p_results_count is null or p_results_count not between 0 and 1000000
    or length(coalesce(v_locality,''))>120 then return; end if;
  -- Clientes anteriores pueden omitir ambos. Los nuevos envían un par completo
  -- y results_count = distancia + localidad, sin duplicar el evento.
  if (p_distance_count is null) <> (p_locality_count is null) then return; end if;
  if p_distance_count is not null then
    if p_distance_count not between 0 and 1000000 or p_locality_count not between 0 and 1000000 then return; end if;
    if p_distance_count+p_locality_count<>p_results_count then return; end if;
  end if;
  -- Mantiene la higiene de texto y no recibe usuario, coordenadas ni contacto.
  if v_query ~* '@|https?://|[0-9][0-9 ()+.-]{7,}[0-9]' then return; end if;
  if coalesce(v_locality,'') ~* '@|https?://' then v_locality := null; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id) then return; end if;
  insert into public.search_events(id,query,results_count,category_id,locality,distance_results_count,locality_results_count)
    values(p_id,v_query,p_results_count,p_category_id,v_locality,p_distance_count,p_locality_count)
    on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_search_event(uuid,text,integer,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.record_search_event(uuid,text,integer,uuid,text,integer,integer) to anon,authenticated;

notify pgrst, 'reload schema';
commit;

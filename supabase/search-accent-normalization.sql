-- Delta posterior a marketplace-pagination.sql, business-analytics.sql y business-verification.sql.
-- Reutiliza private.normalize_search_query; no cambia Analytics, datos ni RLS.
-- Aplicar manualmente. No registra búsquedas ni almacena coordenadas del comprador.
-- Mantiene matching por subcadena y paginación en PostgreSQL. En escala barrial:
-- mismo scan existente, con costo extra de normalización; no agrega índices inútiles
-- para strpos. Medir EXPLAIN en catálogos grandes antes de adoptar índices trigram.
begin;

create or replace function public.read_marketplace_page(
  p_query text default '', p_category text default '', p_filters text[] default '{}',
  p_sort text default 'recommended', p_home boolean default false,
  p_favorite_ids uuid[] default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_offset integer default 0, p_limit integer default 12
) returns table(product_ids uuid[], total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_query text := private.normalize_search_query(coalesce(p_query,''));
  v_filters text[] := coalesce(p_filters,'{}');
  v_sort text := coalesce(p_sort,'recommended');
  v_home boolean;
  v_offset integer := greatest(0,coalesce(p_offset,0));
  v_limit integer;
begin
  if length(v_query)>160 or length(coalesce(p_category,''))>160
    or v_sort not in ('recommended','distance','price')
    or not (v_filters <@ array['today','nearby','delivery','pickup','confirmed']::text[])
    or array_position(v_filters,null) is not null
    or (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and not (p_latitude between -90 and 90 and p_longitude between -180 and 180)) then
    raise exception 'marketplace_invalid_input' using errcode='22023';
  end if;
  if p_latitude is null and ('nearby'=any(v_filters) or v_sort='distance') then
    raise exception 'marketplace_location_required' using errcode='22023';
  end if;
  v_home := coalesce(p_home,false) and v_query='' and coalesce(p_category,'')=''
    and p_favorite_ids is null and v_sort='recommended';
  -- Límites impuestos en PostgreSQL, incluso si se pide un p_limit mayor.
  v_limit := greatest(1,least(coalesce(p_limit,12),case when coalesce(p_home,false) and v_query='' then 12 else 24 end));

  return query
  with candidates as (
    select p.id,p.business_id,p.price,
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
    where (not ('today'=any(v_filters)) or available)
      and (not ('confirmed'=any(v_filters)) or confirmed_at is not null)
      and (not ('nearby'=any(v_filters)) or distance_km<=5)
  ), ranked as (
    select f.*,row_number() over (partition by f.business_id order by
      case when v_sort='recommended' and v_query<>'' then f.relevance end,
      case when v_sort='recommended' then f.available end desc,
      case when v_sort='price' then f.price end,
      case when v_sort='distance' then f.distance_km end nulls last,
      case when v_home then f.distance_km end nulls last,
      f.confirmed_at desc nulls last,f.id) as business_position
    from filtered f
  ), ordered as (
    select r.id,row_number() over (order by
      case when v_home then r.business_position else 0 end,
      case when v_sort='recommended' and v_query<>'' then r.relevance end,
      case when v_sort='recommended' then r.available end desc,
      case when v_sort='price' then r.price end,
      case when v_sort='distance' then r.distance_km end nulls last,
      case when v_home then r.distance_km end nulls last,
      r.confirmed_at desc nulls last,r.id) as position
    from ranked r
  ), page as (
    select o.id,o.position from ordered o order by o.position limit v_limit offset v_offset
  )
  select coalesce((select array_agg(page.id order by page.position) from page),'{}'::uuid[]),
    (select count(*) from filtered);
end;
$$;

revoke all on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer) from public,anon,authenticated;
grant execute on function public.read_marketplace_page(text,text,text[],text,boolean,uuid[],double precision,double precision,integer,integer) to anon,authenticated;


-- Same public store-search projection, restricted to active businesses.
create or replace function public.search_public_stores(p_query text, p_with_distance boolean default false)
returns table(id uuid, slug text, name text, city text, logo_url text,
  pickup_enabled boolean, delivery_enabled boolean, verified boolean,
  latitude double precision, longitude double precision, business_categories jsonb)
language sql stable security definer set search_path='' as $$
  with term as (select private.normalize_search_query(left(coalesce(p_query,''),160)) as value),
  matches as (
    select b.*, t.value,
      private.normalize_search_query(b.name) as normalized_name
    from public.businesses b cross join term t
    where b.active and t.value<>''
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
    when strpos(m.normalized_name,m.value)>0 then 2 else 3 end,m.name,m.id
  limit 8;
$$;
revoke all on function public.search_public_stores(text,boolean) from public,anon,authenticated;
grant execute on function public.search_public_stores(text,boolean) to anon,authenticated;

commit;

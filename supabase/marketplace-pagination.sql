-- Delta: ejecutar DESPUÉS de product-inventory-modes.sql.
-- Reutiliza private.request_distance_km, instalada por request-location-radar.sql.
-- Sólo lectura: no guarda ubicación, búsquedas ni eventos; no modifica RLS.
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
  v_query text := lower(btrim(coalesce(p_query,'')));
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
        when lower(p.name)=v_query then 0
        when starts_with(lower(p.name),v_query) then 1
        when strpos(lower(p.name),v_query)>0 then 2
        when strpos(lower(coalesce(p.brand,'')),v_query)>0 or strpos(lower(coalesce(p.model,'')),v_query)>0 then 3
        else 4 end as relevance
    from public.products p
    join public.businesses b on b.id=p.business_id
    join public.categories c on c.id=p.category_id
    -- Sólo IDs de productos y comercios activos; nunca propietarios ni datos privados.
    where p.active and b.active
      and (coalesce(p_category,'')='' or c.slug=p_category)
      and (p_favorite_ids is null or p.id=any(p_favorite_ids))
      and (v_query='' or strpos(lower(p.name),v_query)>0
        or strpos(lower(coalesce(p.brand,'')),v_query)>0
        or strpos(lower(coalesce(p.model,'')),v_query)>0
        or strpos(lower(p.description),v_query)>0)
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

commit;

-- Corrección de funciones YA desplegadas. No volver a ejecutar las migraciones históricas.
-- PostgREST usa READ ONLY para STABLE, incluso por POST. require_admin bloquea
-- admin_users con FOR SHARE: estas lecturas necesitan VOLATILE para conservar
-- ese control transaccional. No se eliminan guardas ni se modifican datos/permisos.
-- admin_read sólo agrega verified a los resultados de comercios para la lista.
begin;
create or replace function public.admin_search_analytics(p_days integer default 30,p_locality text default null,
  p_min_searches integer default 2,p_opportunity_page integer default 1,p_top_page integer default 1)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.require_admin();
  if p_days is null or p_days not in (7,30,90) or p_min_searches is null or p_min_searches not in (1,2,3)
    or p_opportunity_page is null or p_opportunity_page not between 1 and 100000
    or p_top_page is null or p_top_page not between 1 and 100000
    or length(coalesce(p_locality,''))>120 then raise exception 'analytics_invalid_filters' using errcode='22023'; end if;
  with period as materialized (
    select query,normalized_query,results_count,locality,created_at from public.search_events
    where created_at >= now()-make_interval(days=>p_days)
      and length(normalized_query) between 2 and 120
      and query !~* '@|https?://|[0-9][0-9 ()+.-]{7,}[0-9]'
  ), scoped as materialized (
    select * from period where nullif(p_locality,'') is null
      or not exists(select 1 from period l where l.locality=p_locality) or locality=p_locality
  ), grouped as materialized (
    select normalized_query as term,min(query) as display_term,count(*) as total,
      count(*) filter(where results_count>0) as with_results,
      count(*) filter(where results_count=0) as without_results,
      round(100.0*count(*) filter(where results_count=0)/count(*),1) as zero_rate,
      max(created_at) as last_search from scoped group by normalized_query
  ), opportunities as materialized (
    select * from grouped where total>=p_min_searches and without_results>0
  ), opportunity_page as (
    select * from opportunities order by without_results desc,zero_rate desc,total desc,term
    limit 20 offset (p_opportunity_page-1)*20
  ), top_page as (
    select * from grouped order by total desc,term limit 20 offset (p_top_page-1)*20
  )
  select jsonb_build_object(
    'summary',(select jsonb_build_object('total',count(*),'with_results',count(*) filter(where results_count>0),
      'without_results',count(*) filter(where results_count=0),
      'zero_rate',coalesce(round(100.0*count(*) filter(where results_count=0)/nullif(count(*),0),1),0)) from scoped),
    'localities',coalesce((select jsonb_agg(locality order by locality) from (select distinct locality from period where locality is not null) l),'[]'::jsonb),
    'opportunities',coalesce((select jsonb_agg(to_jsonb(o) order by without_results desc,zero_rate desc,total desc,term) from opportunity_page o),'[]'::jsonb),
    'opportunities_total',(select count(*) from opportunities),
    'top',coalesce((select jsonb_agg(to_jsonb(t) order by total desc,term) from top_page t),'[]'::jsonb),
    'top_total',(select count(*) from grouped)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_read_business_verification(p_business_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object('verified',b.verified,
    'verified_at',case when b.verified then a.created_at end,
    'verified_by',case when b.verified then a.admin_user_id end,
    'admin_name',case when b.verified then pr.full_name end)
    into v_result from public.businesses b
    left join lateral (select created_at,admin_user_id from private.admin_audit_logs
      where entity_type='business' and entity_id=b.id and action='BUSINESS_VERIFIED'
      order by created_at desc,id desc limit 1) a on b.verified
    left join public.profiles pr on pr.id=a.admin_user_id where b.id=p_business_id;
  if v_result is null then raise exception 'business_verification_not_found' using errcode='P0002'; end if;
  return v_result;
end;
$$;

create or replace function public.admin_read(
  p_section text, p_query text default '', p_business_query text default '',
  p_state text default 'all', p_offset integer default 0, p_limit integer default 25, p_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_query text := lower(left(btrim(coalesce(p_query,'')),160));
  v_business_query text := lower(left(btrim(coalesce(p_business_query,'')),160));
  v_limit integer := least(greatest(coalesce(p_limit,25),1),50);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),1000000);
begin
  perform private.require_admin();
  if p_state is null or p_state not in ('all','active','inactive','blocked') then
    raise exception 'admin_invalid_input' using errcode = '22023';
  end if;
  if p_section = 'dashboard' then
    select jsonb_build_object(
      'users',(select count(*) from public.profiles),
      'businesses',(select count(*) from public.businesses),
      'active_businesses',(select count(*) from public.businesses where active),
      'active_products',(select count(*) from public.products p join public.businesses b on b.id=p.business_id where p.active and b.active),
      'orders',(select count(*) from public.reservations),
      'recent_orders',(select count(*) from public.reservations where created_at >= now()-interval '7 days')
    ) into v_result;
  elsif p_section in ('businesses','business') then
    with filtered as (
      select b.id, b.name, b.slug, b.city, b.active, b.verified, b.admin_suspended_at, b.created_at,
        case when p_section = 'business' then b.description else null end as description,
        b.pickup_enabled, b.delivery_enabled, pr.full_name as owner_name
      from public.businesses b left join public.profiles pr on pr.id=b.owner_id
      where (p_section <> 'business' or b.id=p_id)
        and (v_query='' or strpos(lower(b.name),v_query)>0)
        and (p_state='all' or (p_state='active' and b.active)
          or (p_state='inactive' and not b.active) or (p_state='blocked' and b.admin_suspended_at is not null))
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset),
    enriched as (
      select page.*,
        (select count(*) from public.products p where p.business_id=page.id) as product_count,
        coalesce((select jsonb_agg(c.name order by c.name) from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=page.id),'[]'::jsonb) as categories
      from page
    )
    select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(enriched) order by created_at desc,id desc) from enriched),'[]'::jsonb)) into v_result;
  elsif p_section = 'products' then
    with filtered as (
      select p.id,p.name,p.business_id,b.name as business_name,b.active as business_active,
        c.name as category_name,p.price,p.inventory_mode,p.active,p.admin_blocked_at,p.created_at
      from public.products p join public.businesses b on b.id=p.business_id join public.categories c on c.id=p.category_id
      where (v_query='' or strpos(lower(p.name),v_query)>0)
        and (v_business_query='' or strpos(lower(b.name),v_business_query)>0)
        and (p_state='all' or (p_state='active' and p.active) or (p_state='inactive' and not p.active)
          or (p_state='blocked' and p.admin_blocked_at is not null))
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset),
    enriched as (
      select page.*, (select i.url from public.product_images i where i.product_id=page.id order by i.position limit 1) as image_url from page
    )
    select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(enriched) order by created_at desc,id desc) from enriched),'[]'::jsonb)) into v_result;
  elsif p_section = 'audit' then
    with page as (
      select a.id,a.admin_user_id,pr.full_name as admin_name,a.action,a.entity_type,a.entity_id,a.reason,a.created_at,
        a.metadata->>'note' as note,coalesce(b.name,p.name) as resource_name
      from private.admin_audit_logs a left join public.profiles pr on pr.id=a.admin_user_id
      left join public.businesses b on a.entity_type='business' and b.id=a.entity_id
      left join public.products p on a.entity_type='product' and p.id=a.entity_id
      order by a.created_at desc,a.id desc limit v_limit offset v_offset
    ) select jsonb_build_object('total',(select count(*) from private.admin_audit_logs),
      'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb)) into v_result;
  else raise exception 'admin_invalid_section' using errcode = '22023';
  end if;
  return v_result;
end;
$$;

notify pgrst,'reload schema';
commit;


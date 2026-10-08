-- Delta posterior a schema.sql y admin-phase-1.sql. No borra eventos anteriores.
begin;
create or replace function private.normalize_search_query(p_query text)
returns text language sql immutable strict set search_path='' as $$
  select translate(lower(btrim(regexp_replace(p_query,'[[:space:]]+',' ','g'))),
    'áàäâãåéèëêíìïîóòöôõúùüûñ','aaaaaaeeeeiiiiooooouuuun');
$$;
revoke all on function private.normalize_search_query(text) from public,anon,authenticated;
-- Reutiliza results_count. Las columnas personales históricas no se eliminan;
-- la nueva RPC siempre las deja NULL y no permite enviarlas.
alter table public.search_events
  add column if not exists normalized_query text generated always as (private.normalize_search_query(query)) stored,
  add column if not exists has_results boolean generated always as (results_count>0) stored,
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists locality text check (locality is null or length(locality)<=120);
alter table public.search_events enable row level security;
drop policy if exists searches_read_own on public.search_events;
drop policy if exists searches_create_own on public.search_events;
revoke all on public.search_events from public,anon,authenticated;
revoke insert(user_id,query,latitude,longitude,results_count) on public.search_events from public,anon,authenticated;
create index if not exists search_events_normalized_idx on public.search_events(normalized_query,created_at desc);
create index if not exists search_events_locality_date_idx on public.search_events(locality,created_at desc);

create or replace function public.record_search_event(p_id uuid,p_query text,p_results_count integer,
  p_category_id uuid default null,p_locality text default null)
returns void language plpgsql security definer set search_path='' as $$
declare v_query text := btrim(regexp_replace(coalesce(p_query,''),'[[:space:]]+',' ','g'));
  v_locality text := nullif(btrim(p_locality),'');
begin
  if p_id is null or length(v_query) not between 2 and 120
    or p_results_count is null or p_results_count not between 0 and 1000000
    or length(coalesce(v_locality,''))>120 then return; end if;
  -- Evitar datos de contacto/URLs obvios escritos por accidente en el buscador.
  if v_query ~* '@|https?://|[0-9][0-9 ()+.-]{7,}[0-9]' then return; end if;
  if coalesce(v_locality,'') ~* '@|https?://' then v_locality := null; end if;
  if p_category_id is not null and not exists(select 1 from public.categories where id=p_category_id) then return; end if;
  insert into public.search_events(id,query,results_count,category_id,locality)
    values(p_id,v_query,p_results_count,p_category_id,v_locality) on conflict(id) do nothing;
end;
$$;
revoke all on function public.record_search_event(uuid,text,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.record_search_event(uuid,text,integer,uuid,text) to anon,authenticated;

create or replace function public.admin_search_analytics(p_days integer default 30,p_locality text default null,
  p_min_searches integer default 2,p_opportunity_page integer default 1,p_top_page integer default 1)
returns jsonb language plpgsql stable security definer set search_path='' as $$
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
revoke all on function public.admin_search_analytics(integer,text,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.admin_search_analytics(integer,text,integer,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;

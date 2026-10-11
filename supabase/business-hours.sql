-- Ejecutar manualmente después de admin-phase-2.sql. No ejecutar schema histórico.
begin;
alter table public.businesses add column if not exists hours_configured boolean not null default false;
-- Metadata administrada sólo por el RPC; los grants de columnas existentes no cambian.
revoke insert(hours_configured), update(hours_configured) on public.businesses from anon,authenticated;
create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  weekday smallint not null check(weekday between 0 and 6),
  period_index smallint not null check(period_index between 0 and 1),
  opens_at time without time zone not null,
  closes_at time without time zone not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(business_id,weekday,period_index),
  check(opens_at <> closes_at),
  check(opens_at < time '24:00' and closes_at < time '24:00'),
  check(extract(second from opens_at)=0 and extract(second from closes_at)=0)
);
alter table public.business_hours enable row level security;
revoke all on public.business_hours from public,anon,authenticated;
grant select on public.business_hours to anon,authenticated;
drop policy if exists business_hours_public_read on public.business_hours;
create policy business_hours_public_read on public.business_hours for select to anon,authenticated
using (exists(select 1 from public.businesses b where b.id=business_id and ((b.active and b.admin_suspended_at is null) or b.owner_id=auth.uid())));
-- No INSERT/UPDATE/DELETE grants or policies. All user writes go through the RPC.

create or replace function public.read_business_hours(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_configured boolean;
begin
  select hours_configured into v_configured from public.businesses
  where id=p_business_id and ((active and admin_suspended_at is null) or owner_id=auth.uid());
  if not found then return null; end if;
  return jsonb_build_object('configured',v_configured,'periods',coalesce((
    select jsonb_agg(jsonb_build_object('weekday',weekday,'period_index',period_index,
      'opens_at',to_char(opens_at,'HH24:MI'),'closes_at',to_char(closes_at,'HH24:MI')) order by weekday,period_index)
    from public.business_hours where business_id=p_business_id
  ),'[]'::jsonb));
end $$;
revoke all on function public.read_business_hours(uuid) from public;
grant execute on function public.read_business_hours(uuid) to anon,authenticated;

create or replace function public.set_my_business_hours(p_business_id uuid,p_schedule jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_period jsonb; v_open text; v_close text;
begin
  -- Existing guard locks auth.users FOR SHARE, serializing with suspension.
  perform private.require_active_marketplace_user();
  perform 1 from public.businesses where id=p_business_id and owner_id=auth.uid() for update;
  if not found then raise exception 'BUSINESS_NOT_OWNED' using errcode='42501'; end if;
  if jsonb_typeof(p_schedule) is distinct from 'array' then raise exception 'BUSINESS_HOURS_INVALID'; end if;
  if jsonb_array_length(p_schedule)>14 then raise exception 'BUSINESS_HOURS_INVALID'; end if;
  for v_period in select value from jsonb_array_elements(p_schedule) loop
    if jsonb_typeof(v_period) is distinct from 'object'
      or jsonb_typeof(v_period->'weekday') is distinct from 'number'
      or jsonb_typeof(v_period->'period_index') is distinct from 'number'
      or jsonb_typeof(v_period->'opens_at') is distinct from 'string'
      or jsonb_typeof(v_period->'closes_at') is distinct from 'string' then raise exception 'BUSINESS_HOURS_INVALID'; end if;
    if (v_period->>'weekday')::numeric not between 0 and 6 or (v_period->>'weekday')::numeric <> trunc((v_period->>'weekday')::numeric)
      or (v_period->>'period_index')::numeric not in (0,1) then raise exception 'BUSINESS_HOURS_INVALID'; end if;
    v_open := v_period->>'opens_at'; v_close := v_period->>'closes_at';
    if v_open !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or v_close !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or v_open=v_close then raise exception 'BUSINESS_HOURS_INVALID'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(p_schedule) p group by (p->>'weekday')::numeric,(p->>'period_index')::numeric having count(*)>1)
    then raise exception 'BUSINESS_HOURS_INVALID'; end if;
  -- Circular weekly intervals; check overlaps across midnight and Sunday/Monday.
  if exists(
    with periods as (
      select ord, (p->>'weekday')::integer*1440 + split_part(p->>'opens_at',':',1)::integer*60+split_part(p->>'opens_at',':',2)::integer as starts,
        (p->>'weekday')::integer*1440 + split_part(p->>'closes_at',':',1)::integer*60+split_part(p->>'closes_at',':',2)::integer
        + case when (p->>'closes_at')<(p->>'opens_at') then 1440 else 0 end as ends
      from jsonb_array_elements(p_schedule) with ordinality as entry(p,ord)
    ) select 1 from periods a join periods b on a.ord<b.ord cross join (values(-10080),(0),(10080)) shift(minutes)
    where a.starts<b.ends+shift.minutes and b.starts+shift.minutes<a.ends
  ) then raise exception 'BUSINESS_HOURS_OVERLAP'; end if;
  -- Validated replacement in one transaction; any error rolls back all rows.
  delete from public.business_hours where business_id=p_business_id;
  insert into public.business_hours(business_id,weekday,period_index,opens_at,closes_at)
  select p_business_id,(p->>'weekday')::smallint,(p->>'period_index')::smallint,(p->>'opens_at')::time,(p->>'closes_at')::time
  from jsonb_array_elements(p_schedule) p;
  update public.businesses set hours_configured=true where id=p_business_id;
end $$;
revoke all on function public.set_my_business_hours(uuid,jsonb) from public,anon;
grant execute on function public.set_my_business_hours(uuid,jsonb) to authenticated;
commit;

-- Run manually after the existing schema/Auth setup. No data migration or seeds.
begin;
alter table public.requests enable row level security;
drop policy if exists requests_buyer_read on public.requests;
create policy requests_buyer_read on public.requests for select to authenticated
  using (buyer_id = (select auth.uid()));
drop policy if exists requests_buyer_create on public.requests;
create policy requests_buyer_create on public.requests for insert to authenticated
  with check (buyer_id = (select auth.uid()) and status = 'OPEN');
drop policy if exists requests_buyer_finish on public.requests;
create policy requests_buyer_finish on public.requests for update to authenticated
  using (buyer_id = (select auth.uid()) and status = 'OPEN' and expires_at > now())
  with check (buyer_id = (select auth.uid()) and status in ('CLOSED', 'CANCELLED'));

-- Existing column grants already allow the form fields and UPDATE(status) only.
-- A caller-generated UUID is an idempotency key, never an ownership parameter.
grant insert (id, expires_at) on public.requests to authenticated;
revoke delete on public.requests from public, anon, authenticated;

create or replace function public.create_my_request(
  p_request_id uuid, p_title text, p_description text, p_category_id uuid,
  p_radius_km numeric, p_needed_when public.request_needed_when
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_duration interval;
begin
  if v_user is null then raise exception 'request_auth_required' using errcode = '42501'; end if;
  -- Serialize repeat submissions from this account, including concurrent retries.
  perform id from public.profiles where id = v_user for update;
  if not found then raise exception 'request_profile_required' using errcode = '42501'; end if;
  if exists (select 1 from public.requests where id = p_request_id and buyer_id = v_user) then return p_request_id; end if;
  if p_request_id is null or p_title is null or length(btrim(p_title)) not between 3 and 120
    or length(coalesce(p_description, '')) > 1000 or p_radius_km is null or p_radius_km not in (5,10,20,30)
    or p_needed_when is null or not exists (select 1 from public.categories where id = p_category_id) then
    raise exception 'request_invalid_input' using errcode = '22023';
  end if;
  v_duration := case p_needed_when when 'TODAY' then interval '24 hours'
    when 'TOMORROW' then interval '48 hours' when 'THIS_WEEK' then interval '7 days'
    when 'FLEXIBLE' then interval '14 days' end;
  insert into public.requests (id, buyer_id, title, description, category_id, radius_km, needed_when, expires_at)
    values (p_request_id, v_user, btrim(p_title), btrim(coalesce(p_description,'')), p_category_id,
      p_radius_km, p_needed_when, now() + v_duration);
  -- Defaults: OPEN, created_at=now(), latitude/longitude/image_url=NULL.
  return p_request_id;
end;
$$;
revoke all on function public.create_my_request(uuid,text,text,uuid,numeric,public.request_needed_when) from public, anon;
grant execute on function public.create_my_request(uuid,text,text,uuid,numeric,public.request_needed_when) to authenticated;
-- No merchant/public SELECT policy, offer access, cron, or automatic expiry writes.
commit;

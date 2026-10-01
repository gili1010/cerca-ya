-- Run manually AFTER the existing schema.sql. Do not rerun schema.sql or seed.sql.
-- Adds profile creation even when signup returns no session pending email confirmation.
begin;
create or replace function private.create_signup_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 160),
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'phone', '')), 40), '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_signup_profile() from public, anon, authenticated;
drop trigger if exists cercaya_profile_after_signup on auth.users;
create trigger cercaya_profile_after_signup after insert on auth.users
for each row execute function private.create_signup_profile();

-- Only fill missing profiles; preserve all existing names and phone numbers.
insert into public.profiles (id, full_name, phone)
select id, left(coalesce(raw_user_meta_data ->> 'full_name', ''), 160),
  nullif(left(trim(coalesce(raw_user_meta_data ->> 'phone', '')), 40), '')
from auth.users
on conflict (id) do nothing;
commit;

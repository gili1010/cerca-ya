-- Delta mínimo. Ejecutar manualmente después de las migraciones actuales.
begin;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists merchant_terms_accepted_at timestamptz;
revoke insert(terms_accepted_at,privacy_accepted_at,merchant_terms_accepted_at),
  update(terms_accepted_at,privacy_accepted_at,merchant_terms_accepted_at) on public.profiles from anon,authenticated;

-- Mantiene la creación actual de perfil y registra la declaración del registro
-- email/password aun cuando todavía no haya sesión por confirmación de email.
create or replace function private.create_signup_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,full_name,phone,terms_accepted_at,privacy_accepted_at)
  values(new.id,left(coalesce(new.raw_user_meta_data->>'full_name',''),160),
    nullif(left(trim(coalesce(new.raw_user_meta_data->>'phone','')),40),''),
    case when new.raw_user_meta_data->>'legal_accepted'='true' then clock_timestamp() else null end,
    case when new.raw_user_meta_data->>'legal_accepted'='true' then clock_timestamp() else null end)
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_signup_profile() from public,anon,authenticated;
drop trigger if exists cercaya_profile_after_signup on auth.users;
create trigger cercaya_profile_after_signup after insert on auth.users for each row execute function private.create_signup_profile();

create or replace function public.accept_my_legal_terms(p_accept boolean,p_merchant boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare v_now timestamptz:=clock_timestamp();
begin
  if auth.uid() is null then raise exception 'legal_auth_required' using errcode='42501'; end if;
  if p_accept is distinct from true or p_merchant is null then raise exception 'legal_acceptance_required' using errcode='22023'; end if;
  insert into public.profiles(id,full_name)
    select id,left(coalesce(raw_user_meta_data->>'full_name',''),160) from auth.users where id=auth.uid()
    on conflict(id) do nothing;
  update public.profiles set terms_accepted_at=coalesce(terms_accepted_at,v_now),
    privacy_accepted_at=coalesce(privacy_accepted_at,v_now),
    merchant_terms_accepted_at=case when p_merchant then coalesce(merchant_terms_accepted_at,v_now) else merchant_terms_accepted_at end
    where id=auth.uid();
end;
$$;
revoke all on function public.accept_my_legal_terms(boolean,boolean) from public,anon;
grant execute on function public.accept_my_legal_terms(boolean,boolean) to authenticated;

create or replace function private.require_merchant_legal_acceptance() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not exists(select 1 from public.profiles
    where id=auth.uid() and id=new.owner_id and terms_accepted_at is not null
      and privacy_accepted_at is not null and merchant_terms_accepted_at is not null) then
    raise exception 'merchant_legal_acceptance_required' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function private.require_merchant_legal_acceptance() from public,anon,authenticated;
drop trigger if exists merchant_legal_acceptance on public.businesses;
create trigger merchant_legal_acceptance before insert on public.businesses for each row execute function private.require_merchant_legal_acceptance();
-- No se inventa aceptación para cuentas/comercios existentes ni se cambian sus datos.
notify pgrst,'reload schema';
commit;

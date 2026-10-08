-- Delta mínimo posterior a las migraciones actuales. Ejecutar manualmente.
begin;
alter table public.businesses add column if not exists store_shared_at timestamptz;
revoke insert(store_shared_at),update(store_shared_at) on public.businesses from anon,authenticated;
create or replace function public.mark_my_store_shared(p_business_id uuid)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare v_shared_at timestamptz;
begin
  if auth.uid() is null then raise exception 'store_share_auth_required' using errcode='42501'; end if;
  select store_shared_at into v_shared_at from public.businesses
    where id=p_business_id and owner_id=auth.uid() for update;
  if not found then raise exception 'store_share_not_owned' using errcode='42501'; end if;
  if v_shared_at is null then
    update public.businesses set store_shared_at=coalesce(store_shared_at,clock_timestamp())
      where id=p_business_id and owner_id=auth.uid() returning store_shared_at into v_shared_at;
  end if;
  return v_shared_at;
end;
$$;
revoke all on function public.mark_my_store_shared(uuid) from public,anon;
grant execute on function public.mark_my_store_shared(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

-- Ejecutar manualmente después de business-store-slugs.sql y los deltas actuales.
-- No cambia slugs existentes ni crea aliases, historial o redirecciones.
begin;

create or replace function public.is_my_business_slug_available(p_business_id uuid, p_slug text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.businesses where id = p_business_id and owner_id = auth.uid()
  ) then raise exception 'BUSINESS_NOT_OWNED' using errcode = '42501'; end if;
  if p_slug is null or char_length(p_slug) not between 3 and 50
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'BUSINESS_SLUG_INVALID' using errcode = '22023';
  end if;
  -- Incluye comercios inactivos; sólo devuelve disponibilidad, nunca sus datos.
  return not exists (select 1 from public.businesses where slug = p_slug and id <> p_business_id);
end;
$$;

create or replace function public.change_my_business_slug(p_business_id uuid, p_slug text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_slug text;
  v_constraint text;
  v_previous_permission text := current_setting('cercaya.business_slug_change', true);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  select slug into v_slug from public.businesses
    where id = p_business_id and owner_id = auth.uid() for update;
  if not found then raise exception 'BUSINESS_NOT_OWNED' using errcode = '42501'; end if;
  if p_slug is null or char_length(p_slug) not between 3 and 50
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'BUSINESS_SLUG_INVALID' using errcode = '22023';
  end if;
  if v_slug = p_slug then return v_slug; end if;
  -- Sólo esta RPC habilita el trigger para esta fila y dentro de la transacción.
  perform pg_catalog.set_config('cercaya.business_slug_change', p_business_id::text, true);
  begin
    update public.businesses set slug = p_slug
      where id = p_business_id and owner_id = auth.uid();
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    if v_constraint = 'businesses_slug_key' then
      raise exception 'BUSINESS_SLUG_TAKEN' using errcode = '23505';
    end if;
    raise;
  end;
  perform pg_catalog.set_config('cercaya.business_slug_change', coalesce(v_previous_permission, ''), true);
  return p_slug;
end;
$$;

-- Una variable de sesión falsificada no basta: también se exige el rol
-- propietario de la RPC SECURITY DEFINER y el usuario dueño del comercio.
create or replace function private.preserve_business_slug() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.slug is distinct from old.slug then
    if current_user is distinct from (
      select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
      where oid = 'public.change_my_business_slug(uuid,text)'::pg_catalog.regprocedure
    ) or current_setting('cercaya.business_slug_change', true) is distinct from old.id::text
      or auth.uid() is null or old.owner_id is distinct from auth.uid()
      or new.owner_id is distinct from old.owner_id or new.id is distinct from old.id then
      raise exception 'BUSINESS_SLUG_IMMUTABLE' using errcode = '23514';
    end if;
    if new.slug is null or char_length(new.slug) not between 3 and 50
      or new.slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
      raise exception 'BUSINESS_SLUG_INVALID' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function private.preserve_business_slug() from public, anon, authenticated;
drop trigger if exists businesses_preserve_slug on public.businesses;
create trigger businesses_preserve_slug before update of slug on public.businesses
  for each row execute function private.preserve_business_slug();
revoke update (slug) on public.businesses from public, anon, authenticated;
revoke all on function public.is_my_business_slug_available(uuid,text) from public, anon, authenticated;
revoke all on function public.change_my_business_slug(uuid,text) from public, anon, authenticated;
grant execute on function public.is_my_business_slug_available(uuid,text) to authenticated;
grant execute on function public.change_my_business_slug(uuid,text) to authenticated;
-- Reutiliza businesses_slug_key: el UNIQUE resuelve carreras al guardar.
notify pgrst, 'reload schema';
commit;

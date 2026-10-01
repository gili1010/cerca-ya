-- Ejecutar manualmente después del esquema y las migraciones de comercio existentes.
-- No ejecutar nuevamente schema.sql. No modifica productos ni sus políticas.
begin;

alter table public.businesses add column if not exists logo_url text;
alter table public.businesses add column if not exists cover_url text;
-- Los campos nuevos se escriben únicamente mediante el RPC autorizado de abajo.
revoke update (logo_url, cover_url) on public.businesses from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-assets', 'business-assets', true, 2097152, array['image/jpeg','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- UUID comercio / logo|cover / UUID versión.webp|jpg. Nunca usa IDs de usuarios.
create or replace function private.owns_store_asset_path(object_name text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select object_name ~ '^[0-9a-f-]{36}/(logo|cover)/[0-9a-f-]{36}\.(webp|jpg)$'
    and exists (select 1 from public.businesses b
      where b.owner_id = (select auth.uid())
        and b.id::text = (storage.foldername(object_name))[1]);
$$;
revoke all on function private.owns_store_asset_path(text) from public, anon;
grant execute on function private.owns_store_asset_path(text) to authenticated;

create or replace function private.store_asset_in_use(object_name text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.businesses b
    where b.id::text = (storage.foldername(object_name))[1]
      and (split_part(b.logo_url, '/storage/v1/object/public/business-assets/', 2) = object_name
        or split_part(b.cover_url, '/storage/v1/object/public/business-assets/', 2) = object_name));
$$;
revoke all on function private.store_asset_in_use(text) from public, anon;
grant execute on function private.store_asset_in_use(text) to authenticated;

-- El bucket público sirve las imágenes por URL. Sólo el dueño puede listar sus archivos.
drop policy if exists cercaya_business_assets_read on storage.objects;
create policy cercaya_business_assets_read on storage.objects for select to authenticated
using (bucket_id = 'business-assets' and private.owns_store_asset_path(name));
drop policy if exists cercaya_business_assets_insert on storage.objects;
create policy cercaya_business_assets_insert on storage.objects for insert to authenticated
with check (bucket_id = 'business-assets' and private.owns_store_asset_path(name));
drop policy if exists cercaya_business_assets_delete on storage.objects;
create policy cercaya_business_assets_delete on storage.objects for delete to authenticated
using (bucket_id = 'business-assets' and private.owns_store_asset_path(name)
  and not private.store_asset_in_use(name));
-- No UPDATE/upsert: reemplazar carga una versión nueva y cambia el puntero.

create or replace function public.save_my_store_branding(
  p_description text, p_logo_url text, p_cover_url text,
  p_expected_description text, p_expected_logo_url text, p_expected_cover_url text
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_business public.businesses%rowtype;
  v_url text;
  v_kind text;
  v_path text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '42501'; end if;
  -- Propiedad derivada en el servidor; el frontend no elige un business_id.
  select * into v_business from public.businesses
    where owner_id = (select auth.uid()) for update;
  if not found then raise exception 'BUSINESS_NOT_OWNED' using errcode = '42501'; end if;
  if v_business.description is distinct from p_expected_description
    or v_business.logo_url is distinct from p_expected_logo_url
    or v_business.cover_url is distinct from p_expected_cover_url then
    raise exception 'STORE_CHANGED' using errcode = '40001';
  end if;
  if p_description is null or length(trim(p_description)) > 3000 then
    raise exception 'DESCRIPTION_INVALID' using errcode = '22023';
  end if;
  foreach v_kind in array array['logo', 'cover'] loop
    v_url := case when v_kind = 'logo' then p_logo_url else p_cover_url end;
    if v_url is not null then
      if v_url !~ '^https?://[^/?#]+/storage/v1/object/public/business-assets/' then
        raise exception 'ASSET_INVALID' using errcode = '22023';
      end if;
      v_path := split_part(v_url, '/storage/v1/object/public/business-assets/', 2);
      if v_path !~ ('^' || v_business.id::text || '/' || v_kind || '/[0-9a-f-]{36}\.(webp|jpg)$')
        or not exists (select 1 from storage.objects where bucket_id = 'business-assets' and name = v_path) then
        raise exception 'ASSET_INVALID' using errcode = '22023';
      end if;
    end if;
  end loop;
  update public.businesses set description = trim(p_description), logo_url = p_logo_url, cover_url = p_cover_url
    where id = v_business.id and owner_id = (select auth.uid());
end;
$$;
revoke all on function public.save_my_store_branding(text,text,text,text,text,text) from public, anon;
grant execute on function public.save_my_store_branding(text,text,text,text,text,text) to authenticated;

commit;

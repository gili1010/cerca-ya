-- Execute manually after schema.sql. No service_role is used by the application.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- UUID business / UUID product / UUID version.ext. No original filenames.
create or replace function private.owns_product_image_path(object_name text)
returns boolean language sql stable security invoker set search_path = '' as $$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$'
    and exists (
      select 1 from public.products p join public.businesses b on b.id = p.business_id
      where b.owner_id = (select auth.uid())
        and b.id::text = (storage.foldername(object_name))[1]
        and p.id::text = (storage.foldername(object_name))[2]
    );
$$;
revoke all on function private.owns_product_image_path(text) from public, anon;
grant execute on function private.owns_product_image_path(text) to authenticated;

drop policy if exists cercaya_product_images_read on storage.objects;
create policy cercaya_product_images_read on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists cercaya_product_images_insert on storage.objects;
create policy cercaya_product_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and private.owns_product_image_path(name));

drop policy if exists cercaya_product_images_update on storage.objects;
create policy cercaya_product_images_update on storage.objects for update to authenticated
using (bucket_id = 'product-images' and private.owns_product_image_path(name))
with check (bucket_id = 'product-images' and private.owns_product_image_path(name));

drop policy if exists cercaya_product_images_delete on storage.objects;
create policy cercaya_product_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and private.owns_product_image_path(name)
  -- Detach from product_images first; never delete a photo currently in use.
  and not exists (select 1 from public.product_images pi
    where pi.product_id::text = (storage.foldername(name))[2]
      and split_part(pi.url, '?', 1) like '%/storage/v1/object/public/product-images/' || name));

-- product_images already has UNIQUE(product_id, position), owner INSERT/UPDATE/
-- DELETE policies and public read through visible products. Keep those policies.
-- Serialize only the main-photo pointer; image bytes always go through Storage API.
create or replace function public.set_my_product_photo(p_product_id uuid, p_url text, p_expected_url text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  v_business_id uuid;
  v_previous text;
  v_path text;
begin
  select p.business_id into v_business_id from public.products p
    join public.businesses b on b.id = p.business_id
    where p.id = p_product_id and b.owner_id = (select auth.uid()) for update of p;
  if not found then raise exception 'photo_not_owned' using errcode = '42501'; end if;
  select url into v_previous from public.product_images where product_id = p_product_id and position = 0;
  if v_previous is distinct from p_expected_url then
    raise exception 'photo_changed' using errcode = '40001';
  end if;
  if p_url is null then
    delete from public.product_images where product_id = p_product_id and position = 0;
  else
    if p_url !~ '^https?://[^/]+/storage/v1/object/public/product-images/' then
      raise exception 'photo_invalid_url' using errcode = '22023';
    end if;
    v_path := split_part(p_url, '/storage/v1/object/public/product-images/', 2);
    if not private.owns_product_image_path(v_path)
      or (storage.foldername(v_path))[2] <> p_product_id::text
      or not exists (select 1 from storage.objects where bucket_id = 'product-images' and name = v_path) then
      raise exception 'photo_invalid_object' using errcode = '22023';
    end if;
    insert into public.product_images (product_id, url, position) values (p_product_id, p_url, 0)
    on conflict (product_id, position) do update set url = excluded.url;
  end if;
end;
$$;
revoke all on function public.set_my_product_photo(uuid, text, text) from public, anon;
grant execute on function public.set_my_product_photo(uuid, text, text) to authenticated;

commit;

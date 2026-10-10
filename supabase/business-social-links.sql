-- Aplicar manualmente después de las migraciones actuales de comercio.
-- No reemplaza save_my_business: reutiliza su autorización, slug y validaciones.
begin;
alter table public.businesses
  add column if not exists instagram_url text,
  add column if not exists facebook_url text;

create or replace function private.normalize_business_social_link(p_value text, p_network text)
returns text language plpgsql immutable set search_path = '' as $$
declare v text := btrim(p_value); v_host text;
begin
  if p_network not in ('instagram','facebook') or p_network is null then raise exception 'BUSINESS_SOCIAL_INVALID'; end if;
  if v is null or v = '' then return null; end if;
  if length(v) > 300 or v ~ '[[:space:]\\]' then
    raise exception '%', case when p_network='instagram' then 'BUSINESS_INSTAGRAM_INVALID' else 'BUSINESS_FACEBOOK_INVALID' end;
  end if;
  if p_network='instagram' and left(v,1)='@' then v := substr(v,2); end if;
  if v ~ '^[A-Za-z0-9._-]+$' then v := p_network || '.com/' || v; end if;
  v_host := p_network || '.com';
  if left(v,length(v_host)+1)=v_host || '/' or left(v,length(v_host)+5)='www.' || v_host || '/' then v := 'https://' || v; end if;
  -- Host boundary, HTTPS, no credentials, ports, fragments, encoded paths or traversal.
  if length(v)>300 or (v !~ ('^https://(www\.)?' || p_network || '\.com/[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*/?$')
    and not (p_network='facebook' and v ~ '^https://(www\.)?facebook\.com/profile\.php\?id=[0-9]+$')
    or v ~ '/\.{1,2}(/|$)') then
    raise exception '%', case when p_network='instagram' then 'BUSINESS_INSTAGRAM_INVALID' else 'BUSINESS_FACEBOOK_INVALID' end;
  end if;
  return regexp_replace(regexp_replace(v, '^https://www\.', 'https://'), '/$', '');
end $$;
revoke all on function private.normalize_business_social_link(text,text) from public,anon;
grant execute on function private.normalize_business_social_link(text,text) to authenticated;

-- Applies to direct writes too, not only the form/RPC. Existing RLS and suspension
-- guards remain responsible for write authorization.
create or replace function private.validate_business_social_links() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.instagram_url := private.normalize_business_social_link(new.instagram_url,'instagram');
  new.facebook_url := private.normalize_business_social_link(new.facebook_url,'facebook');
  return new;
end $$;
revoke all on function private.validate_business_social_links() from public,anon,authenticated;
drop trigger if exists businesses_validate_social_links on public.businesses;
create trigger businesses_validate_social_links before insert or update of instagram_url,facebook_url
on public.businesses for each row execute function private.validate_business_social_links();

grant insert(instagram_url,facebook_url), update(instagram_url,facebook_url) on public.businesses to authenticated;

create or replace function public.save_my_business_with_social_links(
  p_input jsonb, p_category_ids uuid[], p_business_id uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; v_instagram text; v_facebook text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
  if p_input ? 'instagram_url' and jsonb_typeof(p_input->'instagram_url') not in ('string','null') then raise exception 'BUSINESS_INSTAGRAM_INVALID'; end if;
  if p_input ? 'facebook_url' and jsonb_typeof(p_input->'facebook_url') not in ('string','null') then raise exception 'BUSINESS_FACEBOOK_INVALID'; end if;
  v_instagram := private.normalize_business_social_link(p_input->>'instagram_url','instagram');
  v_facebook := private.normalize_business_social_link(p_input->>'facebook_url','facebook');
  v_id := public.save_my_business(p_input,p_category_ids,p_business_id);
  update public.businesses set
    instagram_url = case when p_input ? 'instagram_url' then v_instagram else instagram_url end,
    facebook_url = case when p_input ? 'facebook_url' then v_facebook else facebook_url end
  where id=v_id and owner_id=auth.uid();
  if not found then raise exception 'BUSINESS_NOT_OWNED' using errcode='42501'; end if;
  return v_id;
end $$;
revoke all on function public.save_my_business_with_social_links(jsonb,uuid[],uuid) from public,anon;
grant execute on function public.save_my_business_with_social_links(jsonb,uuid[],uuid) to authenticated;
commit;

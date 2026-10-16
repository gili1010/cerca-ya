-- Ejecutar MANUALMENTE después de personal-listings.sql.
-- RPC independientes; no reemplaza búsqueda, ubicación ni permisos comerciales.
begin;

create function private.personal_listing_is_public(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.personal_listings l
    where l.id=p_id and l.status='PUBLISHED' and l.admin_blocked_at is null
      and (l.expires_at is null or l.expires_at>now())
      and not exists(select 1 from private.user_suspensions s where s.user_id=l.owner_id)
      and exists(select 1 from private.personal_listing_locations loc where loc.listing_id=l.id)
      and exists(select 1 from public.personal_listing_images i join storage.objects o
        on o.bucket_id='personal-listing-images' and o.name=i.object_path
        where i.listing_id=l.id and i.position=0)
  );
$$;
revoke all on function private.personal_listing_is_public(uuid) from public,anon,authenticated;

-- Sólo el dueño lee filas base. Visitantes usan exclusivamente las proyecciones RPC.
grant select on public.personal_listings,public.personal_listing_images to authenticated;
create policy personal_listings_read_own on public.personal_listings for select to authenticated
  using (owner_id=(select auth.uid()));
create policy personal_listing_images_read_own on public.personal_listing_images for select to authenticated
  using (exists(select 1 from public.personal_listings l where l.id=listing_id and l.owner_id=(select auth.uid())));
-- private.personal_listing_locations sigue sin grants ni policies de lectura directa.

-- Constructor interno explícito: jamás serializa una fila completa ni un perfil.
create function private.personal_listing_document(p_id uuid,p_owner boolean) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',l.id,'category_id',l.category_id,'category_name',c.name,'category_slug',c.slug,
    'title',l.title,'description',l.description,'price',l.price,'currency',l.currency,
    'negotiable',l.negotiable,'item_condition',l.item_condition,'status',l.status,
    'seller_display_name',l.seller_display_name,'contact_method',l.contact_method,
    'contact_whatsapp',l.contact_whatsapp,'city',loc.city,'province',loc.province,
    'province_code',loc.province_code,'country_code',loc.country_code,
    'created_at',l.created_at,'updated_at',l.updated_at,'published_at',l.published_at,'expires_at',l.expires_at,
    'images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'object_path',i.object_path,'position',i.position) order by i.position)
      from public.personal_listing_images i where i.listing_id=l.id),'[]'::jsonb)
  ) || case when p_owner then jsonb_build_object(
    'owner_id',l.owner_id,'revision',l.revision,'contact_consent_at',l.contact_consent_at,
    'admin_blocked',l.admin_blocked_at is not null,'admin_block_reason',l.admin_block_reason,
    'expired',l.expires_at is not null and l.expires_at<=now()
  ) else '{}'::jsonb end
  from public.personal_listings l join public.categories c on c.id=l.category_id
    join private.personal_listing_locations loc on loc.listing_id=l.id where l.id=p_id;
$$;
revoke all on function private.personal_listing_document(uuid,boolean) from public,anon,authenticated;

create function public.save_my_personal_listing(
  p_input jsonb,p_listing_id uuid default null,p_expected_revision bigint default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid := coalesce(p_listing_id,gen_random_uuid());
  v_old public.personal_listings%rowtype;
  v_title text; v_description text; v_price numeric; v_category uuid; v_condition text;
  v_negotiable boolean; v_city text; v_province_code text; v_province text;
  v_contact text; v_phone text; v_consent boolean; v_consent_at timestamptz;
  v_display text; v_expires timestamptz;
begin
  perform private.require_active_marketplace_user();
  if jsonb_typeof(p_input) is distinct from 'object' then
    raise exception 'PERSONAL_LISTING_INVALID_INPUT' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_object_keys(p_input) k where k not in (
      'category_id','title','description','price','negotiable','item_condition','city','province_code',
      'contact_method','contact_whatsapp','contact_consent','seller_display_name','expires_at'
    )
  ) then raise exception 'PERSONAL_LISTING_INVALID_INPUT' using errcode='22023'; end if;
  -- No acepta owner_id, status, moderación, país arbitrario, domicilio ni GPS.
  if jsonb_typeof(p_input->'title') is distinct from 'string'
    or jsonb_typeof(p_input->'category_id') is distinct from 'string'
    or jsonb_typeof(p_input->'item_condition') is distinct from 'string'
    or jsonb_typeof(p_input->'city') is distinct from 'string'
    or jsonb_typeof(p_input->'province_code') is distinct from 'string'
    or jsonb_typeof(p_input->'price') is distinct from 'number'
    or (p_input ? 'description' and jsonb_typeof(p_input->'description') is distinct from 'string')
    or (p_input ? 'negotiable' and jsonb_typeof(p_input->'negotiable') is distinct from 'boolean')
    or (p_input ? 'seller_display_name' and jsonb_typeof(p_input->'seller_display_name') is distinct from 'string')
    or (p_input ? 'contact_method' and jsonb_typeof(p_input->'contact_method') is distinct from 'string')
    or (p_input ? 'contact_consent' and jsonb_typeof(p_input->'contact_consent') is distinct from 'boolean')
    or (p_input ? 'contact_whatsapp' and jsonb_typeof(p_input->'contact_whatsapp') not in ('string','null'))
    or (p_input ? 'expires_at' and jsonb_typeof(p_input->'expires_at') not in ('string','null')) then
    raise exception 'PERSONAL_LISTING_INVALID_INPUT' using errcode='22023';
  end if;
  v_title := btrim(regexp_replace(p_input->>'title','[[:space:]]+',' ','g'));
  v_description := coalesce(p_input->>'description','');
  v_price := (p_input->>'price')::numeric;
  v_condition := p_input->>'item_condition';
  v_negotiable := coalesce((p_input->>'negotiable')::boolean,false);
  v_city := btrim(regexp_replace(p_input->>'city','[[:space:]]+',' ','g'));
  v_province_code := p_input->>'province_code';
  v_province := private.argentina_province_name(v_province_code);
  v_contact := coalesce(p_input->>'contact_method','NONE');
  v_consent := coalesce((p_input->>'contact_consent')::boolean,false);
  v_display := btrim(coalesce(p_input->>'seller_display_name',''));
  if length(v_title) not between 1 and 160 or v_title ~ '[[:cntrl:]]'
    or length(v_description)>5000 or v_price not between 0 and 9999999999.99
    or round(v_price,2)<>v_price or v_condition not in ('NEW','USED')
    or length(v_city) not between 1 and 120 or v_city ~ '[[:cntrl:]]'
    or private.normalize_search_query(v_city)='' or v_province is null
    or length(v_display)>120 or v_display ~ '[[:cntrl:]]' or v_contact not in ('NONE','WHATSAPP') then
    raise exception 'PERSONAL_LISTING_INVALID_INPUT' using errcode='22023';
  end if;
  begin
    v_category := (p_input->>'category_id')::uuid;
    v_expires := nullif(p_input->>'expires_at','')::timestamptz;
  exception when invalid_text_representation or invalid_datetime_format or datetime_field_overflow then
    raise exception 'PERSONAL_LISTING_INVALID_INPUT' using errcode='22023';
  end;
  if not exists(select 1 from public.categories where id=v_category) then
    raise exception 'PERSONAL_LISTING_CATEGORY_INVALID' using errcode='22023';
  end if;
  if v_contact='WHATSAPP' then
    if not v_consent or coalesce(p_input->>'contact_whatsapp','') !~ '^\+54(9)?[1-9][0-9]{9}$' then
      raise exception 'PERSONAL_LISTING_CONTACT_REQUIRED' using errcode='22023';
    end if;
    v_phone := p_input->>'contact_whatsapp';
  elsif v_consent or nullif(p_input->>'contact_whatsapp','') is not null then
    raise exception 'PERSONAL_LISTING_INVALID_INPUT' using errcode='22023';
  end if;
  if not exists(select 1 from public.profiles where id=auth.uid()) then
    raise exception 'PERSONAL_LISTING_PROFILE_REQUIRED' using errcode='42501';
  end if;
  select * into v_old from public.personal_listings where id=v_id for update;
  if found then
    if v_old.owner_id<>auth.uid() then raise exception 'PERSONAL_LISTING_NOT_OWNED' using errcode='42501'; end if;
    if v_old.admin_blocked_at is not null then raise exception 'PERSONAL_LISTING_BLOCKED' using errcode='42501'; end if;
    if v_old.status in ('SOLD','WITHDRAWN') then raise exception 'PERSONAL_LISTING_FINAL_STATE' using errcode='22023'; end if;
    if p_expected_revision is null or p_expected_revision<>v_old.revision then
      raise exception 'PERSONAL_LISTING_CHANGED' using errcode='40001';
    end if;
  elsif p_expected_revision is not null then
    raise exception 'PERSONAL_LISTING_NOT_OWNED' using errcode='42501';
  end if;
  if v_expires is not null and (not isfinite(v_expires) or v_expires<=clock_timestamp()) then
    raise exception 'PERSONAL_LISTING_EXPIRY_INVALID' using errcode='22023';
  end if;
  if v_contact='WHATSAPP' then
    v_consent_at := case when v_old.contact_method='WHATSAPP' and v_old.contact_whatsapp=v_phone
      then v_old.contact_consent_at else clock_timestamp() end;
  end if;
  if v_old.id is null then
    insert into public.personal_listings(id,owner_id,category_id,title,description,price,negotiable,item_condition,
      seller_display_name,contact_method,contact_whatsapp,contact_consent_at,expires_at)
    values(v_id,auth.uid(),v_category,v_title,v_description,v_price,v_negotiable,v_condition,
      v_display,v_contact,v_phone,v_consent_at,v_expires);
  else
    update public.personal_listings set category_id=v_category,title=v_title,description=v_description,
      price=v_price,negotiable=v_negotiable,item_condition=v_condition,seller_display_name=v_display,
      contact_method=v_contact,contact_whatsapp=v_phone,contact_consent_at=v_consent_at,expires_at=v_expires where id=v_id;
  end if;
  insert into private.personal_listing_locations(listing_id,city,province_code,province,country_code)
    values(v_id,v_city,v_province_code,v_province,'AR')
    on conflict(listing_id) do update set city=excluded.city,province_code=excluded.province_code,province=excluded.province;
  return v_id;
end;
$$;

create function public.manage_my_personal_listing(p_listing_id uuid,p_action text,p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_listing public.personal_listings%rowtype; v_status text;
begin
  perform private.require_active_marketplace_user();
  select * into v_listing from public.personal_listings where id=p_listing_id and owner_id=auth.uid() for update;
  if not found then raise exception 'PERSONAL_LISTING_NOT_OWNED' using errcode='42501'; end if;
  if v_listing.admin_blocked_at is not null then raise exception 'PERSONAL_LISTING_BLOCKED' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<>v_listing.revision then
    raise exception 'PERSONAL_LISTING_CHANGED' using errcode='40001';
  end if;
  v_status := case p_action when 'publish' then 'PUBLISHED' when 'pause' then 'PAUSED'
    when 'sold' then 'SOLD' when 'withdraw' then 'WITHDRAWN' else null end;
  if v_status is null then raise exception 'PERSONAL_LISTING_INVALID_TRANSITION' using errcode='22023'; end if;
  if v_status=v_listing.status then return p_listing_id; end if;
  if v_status='PUBLISHED' and v_listing.expires_at is not null and v_listing.expires_at<=clock_timestamp() then
    raise exception 'PERSONAL_LISTING_EXPIRY_INVALID' using errcode='22023';
  end if;
  update public.personal_listings set status=v_status,
    published_at=case when v_status='PUBLISHED' then coalesce(published_at,clock_timestamp()) else published_at end
    where id=p_listing_id;
  -- El trigger diferido verifica fotos, localidad y contacto al terminar la transacción.
  return p_listing_id;
end;
$$;

create function public.set_my_personal_listing_images(p_listing_id uuid,p_paths text[],p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_listing public.personal_listings%rowtype; v_count integer; v_path text; v_position integer := 0;
begin
  perform private.require_active_marketplace_user();
  select * into v_listing from public.personal_listings where id=p_listing_id and owner_id=auth.uid() for update;
  if not found then raise exception 'PERSONAL_LISTING_NOT_OWNED' using errcode='42501'; end if;
  if v_listing.admin_blocked_at is not null then raise exception 'PERSONAL_LISTING_BLOCKED' using errcode='42501'; end if;
  if p_expected_revision is null or p_expected_revision<>v_listing.revision then
    raise exception 'PERSONAL_LISTING_CHANGED' using errcode='40001';
  end if;
  v_count := cardinality(p_paths);
  if p_paths is null or v_count>5 or array_position(p_paths,null) is not null
    or (select count(distinct path) from unnest(p_paths) path)<>v_count
    or (v_listing.status='PUBLISHED' and v_count=0) then
    raise exception 'PERSONAL_LISTING_IMAGES_INVALID' using errcode='22023';
  end if;
  foreach v_path in array p_paths loop
    if v_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'
      or split_part(v_path,'/',1)<>p_listing_id::text
      or not exists(select 1 from storage.objects where bucket_id='personal-listing-images' and name=v_path) then
      raise exception 'PERSONAL_LISTING_IMAGES_INVALID' using errcode='22023';
    end if;
  end loop;
  -- Las relaciones y posiciones se reconstruyen atómicamente; object_path es estable.
  -- El borrado aquí afecta relaciones; los bytes se eliminan mediante Storage API.
  delete from public.personal_listing_images where listing_id=p_listing_id;
  foreach v_path in array p_paths loop
    insert into public.personal_listing_images(listing_id,object_path,position)
      values(p_listing_id,v_path,v_position);
    v_position := v_position+1;
  end loop;
  update public.personal_listings set updated_at=clock_timestamp() where id=p_listing_id;
  return p_listing_id;
end;
$$;

-- Búsqueda nativa GIN, con palabras/prefijos normalizados. Sin pg_trgm/PostGIS
-- ni extensiones nuevas. Los términos se entrecomillan antes de construir tsquery.
create function private.personal_listing_search_query(p_query text) returns tsquery
language sql immutable set search_path='' as $$
  select string_agg(quote_literal(term) || ':*',' & ')::tsquery
  from unnest(tsvector_to_array(to_tsvector('pg_catalog.simple'::regconfig,
    private.normalize_search_query(p_query)))) term;
$$;
revoke all on function private.personal_listing_search_query(text) from public,anon,authenticated;

create function public.read_my_personal_listings(p_listing_id uuid default null,p_status text default null,
  p_query text default '',p_category_id uuid default null,p_locality text default null,p_province_code text default null,
  p_from timestamptz default null,p_until timestamptz default null,p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_query text := private.normalize_search_query(coalesce(p_query,'')); v_result jsonb;
begin
  if auth.uid() is null then raise exception 'account_auth_required' using errcode='42501'; end if;
  if (p_status is not null and p_status not in ('DRAFT','PUBLISHED','PAUSED','SOLD','WITHDRAWN'))
    or length(v_query)>160 or length(coalesce(p_locality,''))>120
    or ((nullif(btrim(p_locality),'') is null) <> (p_province_code is null))
    or (p_province_code is not null and private.argentina_province_name(p_province_code) is null)
    or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50
    or (p_from is not null and not isfinite(p_from)) or (p_until is not null and not isfinite(p_until))
    or (p_from is not null and p_until is not null and p_from>=p_until) then
    raise exception 'PERSONAL_LISTING_FILTER_INVALID' using errcode='22023';
  end if;
  with scoped as materialized (
    select l.id,l.created_at from public.personal_listings l join private.personal_listing_locations loc on loc.listing_id=l.id
    where l.owner_id=auth.uid() and (p_listing_id is null or l.id=p_listing_id)
      and (p_status is null or l.status=p_status) and (p_category_id is null or l.category_id=p_category_id)
      and (nullif(btrim(p_locality),'') is null or loc.city_normalized=private.normalize_search_query(p_locality) and loc.province_code=p_province_code)
      and (v_query='' or l.search_document @@ private.personal_listing_search_query(v_query))
      and (p_from is null or l.created_at>=p_from) and (p_until is null or l.created_at<p_until)
  ), page as (select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(private.personal_listing_document(id,true) order by created_at desc,id desc) from page),'[]'::jsonb),
    'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  return v_result;
end;
$$;

create function public.read_public_personal_listing(p_listing_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when private.personal_listing_is_public(p_listing_id)
    then private.personal_listing_document(p_listing_id,false) else null end;
$$;

create function public.read_personal_listings_page(p_locality text,p_province_code text,
  p_query text default '',p_category_id uuid default null,p_condition text default null,p_status text default 'PUBLISHED',
  p_from timestamptz default null,p_until timestamptz default null,p_sort text default 'newest',
  p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_query text := private.normalize_search_query(coalesce(p_query,'')); v_city text := private.normalize_search_query(coalesce(p_locality,''));
  v_result jsonb;
begin
  if v_city='' or length(v_city)>120 or private.argentina_province_name(p_province_code) is null
    or length(v_query)>160 or p_status is distinct from 'PUBLISHED'
    or (p_condition is not null and p_condition not in ('NEW','USED'))
    or p_sort is null or p_sort not in ('newest','price_asc','price_desc')
    or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50
    or (p_from is not null and not isfinite(p_from)) or (p_until is not null and not isfinite(p_until))
    or (p_from is not null and p_until is not null and p_from>=p_until) then
    raise exception 'PERSONAL_LISTING_FILTER_INVALID' using errcode='22023';
  end if;
  with scoped as materialized (
    select l.id,l.published_at,l.price from private.personal_listing_locations loc
    join public.personal_listings l on l.id=loc.listing_id
    where loc.country_code='AR' and loc.province_code=p_province_code and loc.city_normalized=v_city
      and l.status='PUBLISHED' and l.admin_blocked_at is null
      and private.personal_listing_is_public(l.id)
      and (p_category_id is null or l.category_id=p_category_id) and (p_condition is null or l.item_condition=p_condition)
      and (v_query='' or l.search_document @@ private.personal_listing_search_query(v_query))
      and (p_from is null or l.published_at>=p_from) and (p_until is null or l.published_at<p_until)
  ), page as (
    select * from scoped order by case when p_sort='price_asc' then price end asc,
      case when p_sort='price_desc' then price end desc,published_at desc,id desc offset p_offset limit p_limit
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(private.personal_listing_document(id,false)
      order by case when p_sort='price_asc' then price end asc,case when p_sort='price_desc' then price end desc,published_at desc,id desc) from page),'[]'::jsonb),
    'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  return v_result;
end;
$$;

-- Bucket privado. No convertir silenciosamente un bucket remoto preexistente.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('personal-listing-images','personal-listing-images',false,2097152,array['image/jpeg','image/webp'])
  on conflict(id) do nothing;
do $$
begin
  if not exists(select 1 from storage.buckets where id='personal-listing-images' and not public
    and file_size_limit=2097152 and allowed_mime_types @> array['image/jpeg','image/webp']
    and allowed_mime_types <@ array['image/jpeg','image/webp']) then
    raise exception 'PERSONAL_LISTING_BUCKET_CONFIGURATION_MISMATCH';
  end if;
end;
$$;

create function private.personal_listing_storage_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.personal_listings l where l.id::text=split_part(p_path,'/',1)
    and (l.owner_id=auth.uid() or (private.personal_listing_is_public(l.id)
      and exists(select 1 from public.personal_listing_images i where i.listing_id=l.id and i.object_path=p_path))));
$$;

-- Los cambios de referencias y las escrituras Storage comparten bloqueo de padre.
-- VOLATILE: la comprobación posterior al bloqueo debe ver los commits concurrentes.
create function private.personal_listing_storage_write(p_path text,p_delete boolean) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_listing public.personal_listings%rowtype; v_count integer;
begin
  if auth.uid() is null or p_path !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$' then return false; end if;
  perform private.require_active_marketplace_user();
  select * into v_listing from public.personal_listings
    where id::text=split_part(p_path,'/',1) and owner_id=auth.uid() for update;
  if not found or v_listing.admin_blocked_at is not null then return false; end if;
  if p_delete then
    return not exists(select 1 from public.personal_listing_images where object_path=p_path);
  end if;
  if v_listing.status in ('SOLD','WITHDRAWN') then return false; end if;
  select count(*) into v_count from storage.objects where bucket_id='personal-listing-images'
    and split_part(name,'/',1)=v_listing.id::text;
  -- Hasta 5 fotos vinculadas + 5 versiones temporales para reemplazo. Limita huérfanos.
  return v_count<10;
end;
$$;
revoke all on function private.personal_listing_storage_read(text),private.personal_listing_storage_write(text,boolean) from public,anon,authenticated;
grant execute on function private.personal_listing_storage_read(text),private.personal_listing_storage_write(text,boolean) to anon,authenticated;

create policy personal_listing_storage_select on storage.objects for select to anon,authenticated
  using (bucket_id='personal-listing-images' and private.personal_listing_storage_read(name));
create policy personal_listing_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id='personal-listing-images' and private.personal_listing_storage_write(name,false));
create policy personal_listing_storage_delete on storage.objects for delete to authenticated
  using (bucket_id='personal-listing-images' and private.personal_listing_storage_write(name,true));
-- Restrictivas: otra policy permisiva remota no debe abrir este bucket accidentalmente.
-- Fuera de este bucket son TRUE y no cambian el acceso comercial existente.
create policy personal_listing_storage_select_boundary on storage.objects as restrictive for select to anon,authenticated
  using (bucket_id<>'personal-listing-images' or private.personal_listing_storage_read(name));
create policy personal_listing_storage_insert_boundary on storage.objects as restrictive for insert to anon,authenticated
  with check (bucket_id<>'personal-listing-images' or private.personal_listing_storage_write(name,false));
create policy personal_listing_storage_delete_boundary on storage.objects as restrictive for delete to anon,authenticated
  using (bucket_id<>'personal-listing-images' or private.personal_listing_storage_write(name,true));
create policy personal_listing_storage_update_boundary on storage.objects as restrictive for update to anon,authenticated
  using (bucket_id<>'personal-listing-images') with check (bucket_id<>'personal-listing-images');

revoke all on function public.save_my_personal_listing(jsonb,uuid,bigint),public.manage_my_personal_listing(uuid,text,bigint),
  public.set_my_personal_listing_images(uuid,text[],bigint),public.read_my_personal_listings(uuid,text,text,uuid,text,text,timestamptz,timestamptz,integer,integer),
  public.read_public_personal_listing(uuid),public.read_personal_listings_page(text,text,text,uuid,text,text,timestamptz,timestamptz,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.save_my_personal_listing(jsonb,uuid,bigint),public.manage_my_personal_listing(uuid,text,bigint),
  public.set_my_personal_listing_images(uuid,text[],bigint),public.read_my_personal_listings(uuid,text,text,uuid,text,text,timestamptz,timestamptz,integer,integer) to authenticated;
grant execute on function public.read_public_personal_listing(uuid),
  public.read_personal_listings_page(text,text,text,uuid,text,text,timestamptz,timestamptz,text,integer,integer) to anon,authenticated;

notify pgrst,'reload schema';
commit;

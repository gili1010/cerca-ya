-- Servicios: RPC, DTO públicos, lectura propia y Storage privado.
-- Ejecutar manualmente después de services.sql.
begin;

create function private.service_input(p_input jsonb,p_types jsonb,p_required text[]) returns void
language plpgsql set search_path='' as $$
declare v_key text;
begin
  if jsonb_typeof(p_input) is distinct from 'object' then raise exception 'SERVICE_INVALID_INPUT' using errcode='22023'; end if;
  foreach v_key in array p_required loop
    if not p_input ? v_key then raise exception 'SERVICE_INVALID_INPUT' using errcode='22023'; end if;
  end loop;
  for v_key in select jsonb_object_keys(p_input) loop
    if not p_types ? v_key or not (jsonb_typeof(p_input->v_key)=any(string_to_array(p_types->>v_key,'|'))) then
      raise exception 'SERVICE_INVALID_INPUT' using errcode='22023';
    end if;
  end loop;
end;
$$;
create function private.service_uuid(p_text text) returns uuid
language plpgsql immutable set search_path='' as $$
begin
  if p_text is null then raise exception 'SERVICE_INVALID_INPUT' using errcode='22023'; end if;
  return p_text::uuid;
exception when invalid_text_representation then raise exception 'SERVICE_INVALID_INPUT' using errcode='22023';
end;
$$;
create function private.service_place(p_city text,p_province text) returns void
language plpgsql immutable set search_path='' as $$
begin
  if p_city is null or length(btrim(p_city)) not between 1 and 120 or p_city ~ '[[:cntrl:]]'
    or private.normalize_search_query(p_city)='' or private.argentina_province_name(p_province) is null then
    raise exception 'SERVICE_LOCATION_INVALID' using errcode='22023';
  end if;
end;
$$;
create function private.service_path(p_path text,p_kind text,p_id uuid) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p_path ~ '^(providers|listings)/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'
    and split_part(p_path,'/',1)=p_kind and split_part(p_path,'/',2)=p_id::text,false);
$$;
create function private.own_service_provider(p_id uuid,p_revision bigint,p_check_revision boolean default true)
returns public.service_providers language plpgsql security definer set search_path='' as $$
declare v_row public.service_providers%rowtype;
begin
  perform private.require_active_marketplace_user();
  select * into v_row from public.service_providers where id=p_id and owner_id=auth.uid() for update;
  if not found then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
  if v_row.admin_blocked_at is not null then raise exception 'SERVICE_BLOCKED' using errcode='42501'; end if;
  if p_check_revision and (p_revision is null or p_revision<>v_row.revision) then raise exception 'SERVICE_CHANGED' using errcode='40001'; end if;
  return v_row;
end;
$$;
create function private.own_service_listing(p_id uuid,p_revision bigint)
returns public.service_listings language plpgsql security definer set search_path='' as $$
declare v_row public.service_listings%rowtype; v_provider uuid;
begin
  select provider_id into v_provider from public.service_listings where id=p_id;
  perform private.own_service_provider(v_provider,null,false);
  select * into v_row from public.service_listings where id=p_id for update;
  if not found then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
  if v_row.admin_blocked_at is not null then raise exception 'SERVICE_BLOCKED' using errcode='42501'; end if;
  if p_revision is null or p_revision<>v_row.revision then raise exception 'SERVICE_CHANGED' using errcode='40001'; end if;
  return v_row;
end;
$$;

create function public.save_my_service_provider(p_input jsonb,p_provider_id uuid,p_expected_revision bigint default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.service_providers%rowtype; v_phone text; v_consent timestamptz; v_contact private.service_provider_contacts%rowtype;
  v_method text; v_active boolean;
begin
  perform private.require_active_marketplace_user();
  perform pg_advisory_xact_lock(hashtextextended('service-provider:'||auth.uid()::text,0));
  perform private.service_input(p_input,
    '{"display_name":"string","description":"string","city":"string","province_code":"string","active":"boolean","contact_method":"string","contact_whatsapp":"string|null","contact_consent":"boolean"}',
    array['display_name','city','province_code']);
  if p_provider_id is null or length(btrim(p_input->>'display_name')) not between 1 and 120
    or (p_input->>'display_name') ~ '[[:cntrl:]]' or length(coalesce(p_input->>'description',''))>5000 then
    raise exception 'SERVICE_INVALID_INPUT' using errcode='22023';
  end if;
  perform private.service_place(p_input->>'city',p_input->>'province_code');
  if not exists(select 1 from public.profiles where id=auth.uid()) then raise exception 'SERVICE_PROFILE_REQUIRED' using errcode='42501'; end if;
  select * into v_old from public.service_providers where owner_id=auth.uid() for update;
  if found then
    if v_old.id<>p_provider_id then raise exception 'SERVICE_PROVIDER_EXISTS' using errcode='23505'; end if;
    perform private.own_service_provider(p_provider_id,p_expected_revision);
  else
    if p_expected_revision is not null then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
    if exists(select 1 from public.service_providers where id=p_provider_id) then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
  end if;
  v_active:=coalesce((p_input->>'active')::boolean,true);
  v_method:=coalesce(p_input->>'contact_method','NONE');
  if v_method not in ('NONE','WHATSAPP') then raise exception 'SERVICE_INVALID_INPUT' using errcode='22023'; end if;
  if v_method='WHATSAPP' then
    v_phone:=p_input->>'contact_whatsapp';
    if not coalesce((p_input->>'contact_consent')::boolean,false) or v_phone is null or v_phone !~ '^\+54(9)?[1-9][0-9]{9}$' then
      raise exception 'SERVICE_CONTACT_REQUIRED' using errcode='22023';
    end if;
    select * into v_contact from private.service_provider_contacts where provider_id=p_provider_id;
    v_consent:=case when v_contact.method='WHATSAPP' and v_contact.whatsapp=v_phone then v_contact.consent_at else clock_timestamp() end;
  elsif nullif(p_input->>'contact_whatsapp','') is not null or coalesce((p_input->>'contact_consent')::boolean,false) then
    raise exception 'SERVICE_INVALID_INPUT' using errcode='22023';
  end if;
  if v_old.id is null then
    insert into public.service_providers(id,owner_id,display_name,description,active)
      values(p_provider_id,auth.uid(),btrim(p_input->>'display_name'),coalesce(p_input->>'description',''),v_active);
  else
    update public.service_providers set display_name=btrim(p_input->>'display_name'),description=coalesce(p_input->>'description',''),active=v_active where id=p_provider_id;
  end if;
  insert into private.service_provider_locations(provider_id,city,province_code,province)
    values(p_provider_id,btrim(regexp_replace(p_input->>'city','[[:space:]]+',' ','g')),p_input->>'province_code',private.argentina_province_name(p_input->>'province_code'))
    on conflict(provider_id) do update set city=excluded.city,province_code=excluded.province_code,province=excluded.province;
  insert into private.service_provider_contacts(provider_id,method,whatsapp,consent_at) values(p_provider_id,v_method,v_phone,v_consent)
    on conflict(provider_id) do update set method=excluded.method,whatsapp=excluded.whatsapp,consent_at=excluded.consent_at;
  return p_provider_id;
end;
$$;

create function public.set_my_service_areas(p_provider_id uuid,p_areas jsonb,p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_area jsonb; v_key text; v_keys text[]:=array[]::text[];
begin
  perform private.own_service_provider(p_provider_id,p_expected_revision);
  if jsonb_typeof(p_areas) is distinct from 'array' then raise exception 'SERVICE_LOCATION_INVALID' using errcode='22023'; end if;
  if jsonb_array_length(p_areas)>30 then raise exception 'SERVICE_AREA_LIMIT' using errcode='22023'; end if;
  -- Validar todo antes de retirar referencias. Un duplicado devuelve error controlado.
  for v_area in select value from jsonb_array_elements(p_areas) loop
    perform private.service_input(v_area,'{"city":"string","province_code":"string"}',array['city','province_code']);
    perform private.service_place(v_area->>'city',v_area->>'province_code');
    v_key:=(v_area->>'province_code')||':'||private.normalize_search_query(v_area->>'city');
    if v_key=any(v_keys) then raise exception 'SERVICE_LOCATION_INVALID' using errcode='22023'; end if;
    v_keys:=array_append(v_keys,v_key);
  end loop;
  delete from public.service_areas where provider_id=p_provider_id;
  for v_area in select value from jsonb_array_elements(p_areas) loop
    insert into public.service_areas(provider_id,city,province_code,province)
      values(p_provider_id,btrim(regexp_replace(v_area->>'city','[[:space:]]+',' ','g')),v_area->>'province_code',private.argentina_province_name(v_area->>'province_code'));
  end loop;
  update public.service_providers set updated_at=clock_timestamp() where id=p_provider_id;
  return p_provider_id;
end;
$$;

create function public.save_my_service_listing(p_provider_id uuid,p_listing_id uuid,p_input jsonb,p_expected_revision bigint default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.service_listings%rowtype; v_category uuid; v_price numeric; v_pricing text; v_mode text;
begin
  perform private.own_service_provider(p_provider_id,null,false);
  perform private.service_input(p_input,
    '{"title":"string","description":"string","category_id":"string","service_mode":"string","pricing_mode":"string","price":"number|null","accepting_inquiries":"boolean"}',
    array['title','category_id','service_mode','pricing_mode']);
  v_category:=private.service_uuid(p_input->>'category_id'); v_price:=(p_input->>'price')::numeric;
  v_pricing:=p_input->>'pricing_mode'; v_mode:=p_input->>'service_mode';
  if p_listing_id is null or length(btrim(p_input->>'title')) not between 1 and 160 or (p_input->>'title') ~ '[[:cntrl:]]'
    or length(coalesce(p_input->>'description',''))>5000 or v_mode not in ('ONSITE','AT_PROVIDER','REMOTE')
    or v_pricing not in ('FIXED','FROM','QUOTE')
    or (v_pricing='QUOTE' and v_price is not null)
    or (v_pricing<>'QUOTE' and (v_price is null or v_price<=0 or v_price>9999999999.99 or round(v_price,2)<>v_price)) then
    raise exception 'SERVICE_INVALID_INPUT' using errcode='22023';
  end if;
  if not exists(select 1 from public.service_categories c where c.id=v_category and c.active and c.parent_id is not null
    and exists(select 1 from public.service_categories root where root.id=c.parent_id and root.active)) then
    raise exception 'SERVICE_CATEGORY_INVALID' using errcode='22023';
  end if;
  select * into v_old from public.service_listings where id=p_listing_id for update;
  if found then
    if v_old.provider_id<>p_provider_id then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
    perform private.own_service_listing(p_listing_id,p_expected_revision);
    if v_old.status='WITHDRAWN' then raise exception 'SERVICE_FINAL_STATE' using errcode='22023'; end if;
    update public.service_listings set title=btrim(p_input->>'title'),description=coalesce(p_input->>'description',''),category_id=v_category,
      service_mode=v_mode,pricing_mode=v_pricing,price=v_price,accepting_inquiries=coalesce((p_input->>'accepting_inquiries')::boolean,true) where id=p_listing_id;
  else
    if p_expected_revision is not null then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
    -- own_service_provider mantiene FOR UPDATE hasta COMMIT. Todas las creaciones
    -- y retiros del mismo prestador se serializan antes de contar/insertar.
    -- WITHDRAWN libera cupo; no existe un límite histórico permanente.
    if (select count(*) from public.service_listings where provider_id=p_provider_id and status<>'WITHDRAWN')>=20 then
      raise exception 'SERVICE_LISTING_LIMIT' using errcode='22023';
    end if;
    insert into public.service_listings(id,provider_id,category_id,title,description,service_mode,pricing_mode,price,accepting_inquiries)
      values(p_listing_id,p_provider_id,v_category,btrim(p_input->>'title'),coalesce(p_input->>'description',''),v_mode,v_pricing,v_price,coalesce((p_input->>'accepting_inquiries')::boolean,true));
  end if;
  return p_listing_id;
end;
$$;

create function public.manage_my_service_listing(p_listing_id uuid,p_action text,p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_old public.service_listings%rowtype; v_status text; v_provider public.service_providers%rowtype;
begin
  v_old:=private.own_service_listing(p_listing_id,p_expected_revision);
  v_status:=case p_action when 'publish' then 'PUBLISHED' when 'pause' then 'PAUSED' when 'withdraw' then 'WITHDRAWN' end;
  if v_status is null then raise exception 'SERVICE_INVALID_TRANSITION' using errcode='22023'; end if;
  if v_status=v_old.status then return p_listing_id; end if;
  if v_status='PUBLISHED' then
    select * into v_provider from public.service_providers where id=v_old.provider_id;
    if not v_provider.active or not exists(select 1 from public.service_categories c where c.id=v_old.category_id and c.active
      and exists(select 1 from public.service_categories root where root.id=c.parent_id and root.active)) then
      raise exception 'SERVICE_PUBLISH_REQUIREMENTS' using errcode='22023';
    end if;
  end if;
  update public.service_listings set status=v_status,published_at=case when v_status='PUBLISHED' then coalesce(published_at,clock_timestamp()) else published_at end where id=p_listing_id;
  return p_listing_id;
end;
$$;

create function public.set_my_service_listing_images(p_listing_id uuid,p_paths text[],p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_row public.service_listings%rowtype; v_path text; v_position integer:=0;
begin
  v_row:=private.own_service_listing(p_listing_id,p_expected_revision);
  if v_row.status='WITHDRAWN' then raise exception 'SERVICE_FINAL_STATE' using errcode='22023'; end if;
  if p_paths is null or cardinality(p_paths)>5 or array_position(p_paths,null) is not null
    or cardinality(p_paths)<>(select count(distinct value) from unnest(p_paths) value) then
    raise exception 'SERVICE_IMAGES_INVALID' using errcode='22023';
  end if;
  foreach v_path in array p_paths loop
    if not private.service_path(v_path,'listings',p_listing_id)
      or not exists(select 1 from storage.objects where bucket_id='service-images' and name=v_path) then
      raise exception 'SERVICE_IMAGES_INVALID' using errcode='22023';
    end if;
  end loop;
  delete from public.service_listing_images where listing_id=p_listing_id;
  foreach v_path in array p_paths loop
    insert into public.service_listing_images(listing_id,object_path,position) values(p_listing_id,v_path,v_position);
    v_position:=v_position+1;
  end loop;
  update public.service_listings set updated_at=clock_timestamp() where id=p_listing_id;
  return p_listing_id;
end;
$$;
create function public.set_my_service_provider_avatar(p_provider_id uuid,p_path text,p_expected_revision bigint)
returns uuid language plpgsql security definer set search_path='' as $$
begin
  perform private.own_service_provider(p_provider_id,p_expected_revision);
  if p_path is not null and (not private.service_path(p_path,'providers',p_provider_id)
    or not exists(select 1 from storage.objects where bucket_id='service-images' and name=p_path)) then
    raise exception 'SERVICE_IMAGES_INVALID' using errcode='22023';
  end if;
  update public.service_providers set avatar_path=p_path where id=p_provider_id;
  return p_provider_id;
end;
$$;

create function private.service_provider_enabled(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.service_providers p where p.id=p_id and p.active and p.admin_blocked_at is null
    and not exists(select 1 from private.user_suspensions s where s.user_id=p.owner_id)
    and exists(select 1 from private.service_provider_locations loc where loc.provider_id=p.id)
    and exists(select 1 from private.service_provider_contacts c where c.provider_id=p.id and c.method='WHATSAPP' and c.consent_at is not null)
    and exists(select 1 from public.service_areas a where a.provider_id=p.id));
$$;
create function private.service_listing_is_public(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.service_listings l join public.service_categories c on c.id=l.category_id
    where l.id=p_id and l.status='PUBLISHED' and l.admin_blocked_at is null and c.active
    and exists(select 1 from public.service_categories root where root.id=c.parent_id and root.active)
    and private.service_provider_enabled(l.provider_id));
$$;
create function private.service_provider_is_public(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.service_provider_enabled(p_id) and exists(select 1 from public.service_listings l where l.provider_id=p_id and private.service_listing_is_public(l.id));
$$;

-- DTO explícitos: no serializar filas base/privadas en rutas públicas.
create function private.service_provider_document(p_id uuid,p_owner boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'display_name',p.display_name,'description',p.description,'avatar_path',p.avatar_path,
   'active',p.active,'city',loc.city,'province',loc.province,'province_code',loc.province_code,'country_code',loc.country_code,
   'created_at',p.created_at,'updated_at',p.updated_at,
   'contact_method',case when p_owner or exists(select 1 from public.service_listings l where l.provider_id=p.id and l.accepting_inquiries and private.service_listing_is_public(l.id)) then c.method else 'NONE' end,
   'contact_whatsapp',case when p_owner or exists(select 1 from public.service_listings l where l.provider_id=p.id and l.accepting_inquiries and private.service_listing_is_public(l.id)) then c.whatsapp end,
   'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'city',a.city,'province',a.province,'province_code',a.province_code,'country_code',a.country_code,'coverage_type',a.coverage_type) order by a.province_code,a.city_normalized) from public.service_areas a where a.provider_id=p.id),'[]'::jsonb))
 || case when p_owner then jsonb_build_object('owner_id',p.owner_id,'revision',p.revision,'contact_consent_at',c.consent_at,
   'admin_blocked',p.admin_blocked_at is not null,'admin_block_reason',p.admin_block_reason) else '{}'::jsonb end
 from public.service_providers p join private.service_provider_locations loc on loc.provider_id=p.id
 join private.service_provider_contacts c on c.provider_id=p.id where p.id=p_id;
$$;
create function private.service_listing_document(p_id uuid,p_owner boolean) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',l.id,'provider_id',l.provider_id,'category_id',c.id,'category_name',c.name,'category_slug',c.slug,
   'title',l.title,'description',l.description,'service_mode',l.service_mode,'pricing_mode',l.pricing_mode,'price',l.price,'currency',l.currency,
   'status',l.status,'accepting_inquiries',l.accepting_inquiries,'created_at',l.created_at,'updated_at',l.updated_at,'published_at',l.published_at,
   'provider',case when p_owner or l.accepting_inquiries then private.service_provider_document(l.provider_id,p_owner)
     else private.service_provider_document(l.provider_id,false)||jsonb_build_object('contact_method','NONE','contact_whatsapp',null) end,
   'images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'object_path',i.object_path,'position',i.position) order by i.position) from public.service_listing_images i where i.listing_id=l.id),'[]'::jsonb))
 || case when p_owner then jsonb_build_object('revision',l.revision,'admin_blocked',l.admin_blocked_at is not null,'admin_block_reason',l.admin_block_reason) else '{}'::jsonb end
 from public.service_listings l join public.service_categories c on c.id=l.category_id where l.id=p_id;
$$;

create function public.read_my_service_provider() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'account_auth_required' using errcode='42501'; end if;
  select private.service_provider_document(id,true) into v_result from public.service_providers where owner_id=auth.uid();
  return v_result;
end;
$$;
create function public.read_public_service_provider(p_provider_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when private.service_provider_is_public(p_provider_id) then private.service_provider_document(p_provider_id,false) else null end;
$$;
create function public.read_public_service_listing(p_listing_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select case when private.service_listing_is_public(p_listing_id) then private.service_listing_document(p_listing_id,false) else null end;
$$;
create function public.read_service_categories() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'parent_id',c.parent_id,'name',c.name,'slug',c.slug,'position',c.position) order by c.parent_id nulls first,c.position,c.id),'[]'::jsonb)
 from public.service_categories c where c.active and (c.parent_id is null or exists(select 1 from public.service_categories p where p.id=c.parent_id and p.active));
$$;
create function private.service_search_query(p_query text) returns tsquery
language sql immutable set search_path='' as $$
 select string_agg(quote_literal(term)||':*',' & ')::tsquery
 from unnest(tsvector_to_array(to_tsvector('pg_catalog.simple'::regconfig,private.normalize_search_query(p_query)))) term;
$$;

-- Resuelve la taxonomía una vez por búsqueda, sin recalcular documentos de
-- todos los servicios. Nombres/grupos usan FTS; los aliases, igualdad normalizada.
-- No concatena sinónimos en un vector que mezcle palabras de expresiones distintas.
create function private.service_search_category_ids(p_query text) returns uuid[]
language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(c.id order by c.id),'{}'::uuid[])
  from public.service_categories c
  join public.service_categories root on root.id=c.parent_id
  where c.active and root.active and nullif(private.normalize_search_query(p_query),'') is not null
    and (
      to_tsvector('pg_catalog.simple'::regconfig,private.normalize_search_query(c.name||' '||root.name))
        @@ private.service_search_query(p_query)
      or exists(select 1 from private.service_category_search_terms t
        where t.active and t.category_id in (c.id,root.id)
          and t.term_normalized=private.normalize_search_query(p_query))
    );
$$;

create function public.read_service_listings_page(p_locality text,p_province_code text,p_query text default '',
  p_category_id uuid default null,p_provider_id uuid default null,p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_query text:=private.normalize_search_query(coalesce(p_query,''));
  v_text_query tsquery; v_category_ids uuid[];
begin
  perform private.service_place(p_locality,p_province_code);
  if length(v_query)>160 or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'SERVICE_FILTER_INVALID' using errcode='22023'; end if;
  v_text_query:=private.service_search_query(v_query);
  v_category_ids:=private.service_search_category_ids(v_query);
  with scoped as materialized (
    select l.id,l.published_at from public.service_listings l
    where l.status='PUBLISHED' and l.admin_blocked_at is null and private.service_listing_is_public(l.id)
      and exists(select 1 from public.service_areas a where a.provider_id=l.provider_id and a.province_code=p_province_code and a.city_normalized=private.normalize_search_query(p_locality))
      and (p_provider_id is null or l.provider_id=p_provider_id)
      and (p_category_id is null or l.category_id=p_category_id or exists(select 1 from public.service_categories c where c.id=l.category_id and c.parent_id=p_category_id))
      and (v_query='' or l.search_document @@ v_text_query or l.category_id=any(v_category_ids))
  ), page as(select * from scoped order by published_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_listing_document(id,false) order by published_at desc,id desc) from page),'[]'::jsonb),
    'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  return v_result;
end;
$$;
create function public.read_service_providers_page(p_locality text,p_province_code text,p_query text default '',
  p_category_id uuid default null,p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb; v_query text:=private.normalize_search_query(coalesce(p_query,''));
  v_text_query tsquery; v_category_ids uuid[];
begin
  perform private.service_place(p_locality,p_province_code);
  if length(v_query)>160 or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'SERVICE_FILTER_INVALID' using errcode='22023'; end if;
  v_text_query:=private.service_search_query(v_query);
  v_category_ids:=private.service_search_category_ids(v_query);
  with scoped as materialized (
    select p.id,p.created_at from public.service_providers p
    where p.active and p.admin_blocked_at is null and private.service_provider_is_public(p.id)
      and exists(select 1 from public.service_areas a where a.provider_id=p.id and a.province_code=p_province_code and a.city_normalized=private.normalize_search_query(p_locality))
      and exists(select 1 from public.service_listings l join public.service_categories c on c.id=l.category_id
        where l.provider_id=p.id and private.service_listing_is_public(l.id)
          and (p_category_id is null or c.id=p_category_id or c.parent_id=p_category_id)
          and (v_query='' or l.search_document @@ v_text_query
            or p.search_document @@ v_text_query or l.category_id=any(v_category_ids)))
  ), page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_provider_document(id,false) order by created_at desc,id desc) from page),'[]'::jsonb),
    'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  return v_result;
end;
$$;
create function public.read_my_service_listings(p_listing_id uuid default null,p_status text default null,p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if auth.uid() is null then raise exception 'account_auth_required' using errcode='42501'; end if;
  if (p_status is not null and p_status not in ('DRAFT','PUBLISHED','PAUSED','WITHDRAWN')) or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then raise exception 'SERVICE_FILTER_INVALID' using errcode='22023'; end if;
  with scoped as materialized (
    select l.id,l.created_at from public.service_listings l join public.service_providers p on p.id=l.provider_id
    where p.owner_id=auth.uid() and (p_listing_id is null or l.id=p_listing_id) and (p_status is null or l.status=p_status)
  ), page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
  select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_listing_document(id,true) order by created_at desc,id desc) from page),'[]'::jsonb),
    'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  return v_result;
end;
$$;

-- Lectura base exclusivamente propia; los visitantes sólo pueden usar RPC públicas.
grant select on public.service_providers,public.service_listings,public.service_listing_images,public.service_areas to authenticated;
create policy service_providers_own_read on public.service_providers for select to authenticated using(owner_id=(select auth.uid()));
create policy service_listings_own_read on public.service_listings for select to authenticated using(exists(select 1 from public.service_providers p where p.id=provider_id and p.owner_id=(select auth.uid())));
create policy service_images_own_read on public.service_listing_images for select to authenticated using(exists(select 1 from public.service_listings l join public.service_providers p on p.id=l.provider_id where l.id=listing_id and p.owner_id=(select auth.uid())));
create policy service_areas_own_read on public.service_areas for select to authenticated using(exists(select 1 from public.service_providers p where p.id=provider_id and p.owner_id=(select auth.uid())));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('service-images','service-images',false,2097152,array['image/jpeg','image/webp']) on conflict(id) do nothing;
do $$
begin
 if not exists(select 1 from storage.buckets where id='service-images' and not public and file_size_limit=2097152
   and allowed_mime_types @> array['image/jpeg','image/webp'] and allowed_mime_types <@ array['image/jpeg','image/webp']) then raise exception 'SERVICE_BUCKET_CONFIGURATION_MISMATCH'; end if;
end;
$$;
create function private.service_storage_read(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
 select case split_part(p_path,'/',1)
 when 'providers' then exists(select 1 from public.service_providers p where p.id::text=split_part(p_path,'/',2)
   and (p.owner_id=auth.uid() or (p.avatar_path=p_path and private.service_provider_is_public(p.id))))
 when 'listings' then exists(select 1 from public.service_listings l join public.service_providers p on p.id=l.provider_id
   where l.id::text=split_part(p_path,'/',2) and (p.owner_id=auth.uid()
     or (private.service_listing_is_public(l.id) and exists(select 1 from public.service_listing_images i where i.listing_id=l.id and i.object_path=p_path))))
 else false end;
$$;
create function private.service_storage_write(p_path text,p_delete boolean) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare v_kind text:=split_part(p_path,'/',1); v_id uuid; v_provider public.service_providers%rowtype; v_listing public.service_listings%rowtype; v_limit integer;
begin
 if auth.uid() is null then return false; end if;
 begin v_id:=(split_part(p_path,'/',2))::uuid; exception when invalid_text_representation then return false; end;
 if not private.service_path(p_path,v_kind,v_id) then return false; end if;
 perform private.require_active_marketplace_user();
 if v_kind='providers' then
   select * into v_provider from public.service_providers where id=v_id and owner_id=auth.uid() for update;
   if not found or v_provider.admin_blocked_at is not null then return false; end if;
   if p_delete then return v_provider.avatar_path is distinct from p_path; end if;
   v_limit:=2;
 elsif v_kind='listings' then
   select provider_id into v_id from public.service_listings where id=v_id;
   select * into v_provider from public.service_providers where id=v_id and owner_id=auth.uid() for update;
   if not found or v_provider.admin_blocked_at is not null then return false; end if;
   select * into v_listing from public.service_listings where id::text=split_part(p_path,'/',2) for update;
   if not found or v_listing.admin_blocked_at is not null then return false; end if;
   if p_delete then return not exists(select 1 from public.service_listing_images where object_path=p_path); end if;
   if v_listing.status='WITHDRAWN' then return false; end if;
   v_limit:=10;
 else return false;
 end if;
 return (select count(*) from storage.objects where bucket_id='service-images' and split_part(name,'/',1)=v_kind and split_part(name,'/',2)=split_part(p_path,'/',2))<v_limit;
end;
$$;

create policy service_storage_select on storage.objects for select to anon,authenticated using(bucket_id='service-images' and private.service_storage_read(name));
create policy service_storage_select_boundary on storage.objects as restrictive for select to anon,authenticated using(bucket_id<>'service-images' or private.service_storage_read(name));

create policy service_storage_insert on storage.objects for insert to authenticated with check(bucket_id='service-images' and private.service_storage_write(name,false));
create policy service_storage_insert_boundary on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'service-images' or private.service_storage_write(name,false));

create policy service_storage_delete on storage.objects for delete to authenticated using(bucket_id='service-images' and private.service_storage_write(name,true));
create policy service_storage_delete_boundary on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'service-images' or private.service_storage_write(name,true));
create policy service_storage_update_boundary on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'service-images') with check(bucket_id<>'service-images');
revoke all on function private.service_input(jsonb,jsonb,text[]),
  private.service_uuid(text),
  private.service_place(text,text),
  private.service_path(text,text,uuid),
  private.own_service_provider(uuid,bigint,boolean),
  private.own_service_listing(uuid,bigint),
  private.service_provider_enabled(uuid),
  private.service_listing_is_public(uuid),
  private.service_provider_is_public(uuid),
  private.service_provider_document(uuid,boolean),
  private.service_listing_document(uuid,boolean),
  private.service_search_query(text),
  private.service_search_category_ids(text),
  private.service_storage_read(text),
  private.service_storage_write(text,boolean) from public,anon,authenticated;
grant execute on function private.service_storage_read(text),private.service_storage_write(text,boolean) to anon,authenticated;
revoke all on function public.read_public_service_provider(uuid),
  public.read_public_service_listing(uuid),
  public.read_service_categories(),
  public.read_service_listings_page(text,text,text,uuid,uuid,integer,integer),
  public.read_service_providers_page(text,text,text,uuid,integer,integer),
  public.save_my_service_provider(jsonb,uuid,bigint),
  public.set_my_service_areas(uuid,jsonb,bigint),
  public.save_my_service_listing(uuid,uuid,jsonb,bigint),
  public.manage_my_service_listing(uuid,text,bigint),
  public.set_my_service_listing_images(uuid,text[],bigint),
  public.set_my_service_provider_avatar(uuid,text,bigint),
  public.read_my_service_provider(),
  public.read_my_service_listings(uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.read_public_service_provider(uuid),
  public.read_public_service_listing(uuid),
  public.read_service_categories(),
  public.read_service_listings_page(text,text,text,uuid,uuid,integer,integer),
  public.read_service_providers_page(text,text,text,uuid,integer,integer) to anon,authenticated;
grant execute on function public.save_my_service_provider(jsonb,uuid,bigint),
  public.set_my_service_areas(uuid,jsonb,bigint),
  public.save_my_service_listing(uuid,uuid,jsonb,bigint),
  public.manage_my_service_listing(uuid,text,bigint),
  public.set_my_service_listing_images(uuid,text[],bigint),
  public.set_my_service_provider_avatar(uuid,text,bigint),
  public.read_my_service_provider(),
  public.read_my_service_listings(uuid,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;


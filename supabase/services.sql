-- CercaYa 2.0 Servicios, etapa backend. Ejecutar manualmente como postgres.
-- Orden: services.sql -> services-access.sql -> services-moderation.sql.
-- No modifica tablas/RPC/policies históricas.
begin;
do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('private.user_suspensions') is null
    or to_regprocedure('private.require_active_marketplace_user()') is null
    or to_regprocedure('private.require_admin()') is null
    or to_regprocedure('private.argentina_province_name(text)') is null
    or to_regprocedure('private.normalize_search_query(text)') is null
    or to_regclass('storage.objects') is null
    or not exists(select 1 from pg_proc where oid=to_regprocedure('private.normalize_search_query(text)') and provolatile='i') then
    raise exception 'SERVICE_PREREQUISITES_MISSING';
  end if;
end;
$$;

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.service_categories(id) on delete restrict,
  name text not null check(length(btrim(name)) between 1 and 120),
  slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  active boolean not null default true,
  position integer not null default 0,
  check(parent_id is distinct from id)
);
-- IDs/slugs permanentes, taxonomía independiente de public.categories.
insert into public.service_categories(id,name,slug,position) values
('51000000-0000-4000-8000-000000000001','Construcción y mantenimiento','construccion-mantenimiento',1),
('51000000-0000-4000-8000-000000000002','Hogar y jardín','hogar-jardin',2),
('51000000-0000-4000-8000-000000000003','Reparaciones','reparaciones',3),
('51000000-0000-4000-8000-000000000004','Educación','educacion',4),
('51000000-0000-4000-8000-000000000005','Transporte','transporte',5);
insert into public.service_categories(id,parent_id,name,slug,position) values
('51000000-0000-4000-8000-000000000101','51000000-0000-4000-8000-000000000001','Albañilería','albanileria',1),
('51000000-0000-4000-8000-000000000102','51000000-0000-4000-8000-000000000001','Electricidad','electricidad',2),
('51000000-0000-4000-8000-000000000103','51000000-0000-4000-8000-000000000001','Plomería','plomeria',3),
('51000000-0000-4000-8000-000000000104','51000000-0000-4000-8000-000000000001','Pintura','pintura',4),
('51000000-0000-4000-8000-000000000105','51000000-0000-4000-8000-000000000001','Carpintería','carpinteria',5),
('51000000-0000-4000-8000-000000000106','51000000-0000-4000-8000-000000000001','Herrería','herreria',6),
('51000000-0000-4000-8000-000000000107','51000000-0000-4000-8000-000000000002','Jardinería','jardineria',1),
('51000000-0000-4000-8000-000000000108','51000000-0000-4000-8000-000000000002','Corte de pasto','corte-pasto',2),
('51000000-0000-4000-8000-000000000109','51000000-0000-4000-8000-000000000002','Limpieza','limpieza',3),
('51000000-0000-4000-8000-000000000110','51000000-0000-4000-8000-000000000002','Mantenimiento de piletas','mantenimiento-piletas',4),
('51000000-0000-4000-8000-000000000111','51000000-0000-4000-8000-000000000003','Electrodomésticos','electrodomesticos',1),
('51000000-0000-4000-8000-000000000112','51000000-0000-4000-8000-000000000003','Computadoras','computadoras',2),
('51000000-0000-4000-8000-000000000113','51000000-0000-4000-8000-000000000003','Celulares','celulares',3),
('51000000-0000-4000-8000-000000000114','51000000-0000-4000-8000-000000000003','Mecánica automotor','mecanica-automotor',4),
('51000000-0000-4000-8000-000000000115','51000000-0000-4000-8000-000000000003','Aire acondicionado','aire-acondicionado',5),
('51000000-0000-4000-8000-000000000116','51000000-0000-4000-8000-000000000004','Clases particulares','clases-particulares',1),
('51000000-0000-4000-8000-000000000117','51000000-0000-4000-8000-000000000004','Apoyo escolar','apoyo-escolar',2),
('51000000-0000-4000-8000-000000000118','51000000-0000-4000-8000-000000000004','Idiomas','idiomas',3),
('51000000-0000-4000-8000-000000000119','51000000-0000-4000-8000-000000000005','Fletes','fletes',1),
('51000000-0000-4000-8000-000000000120','51000000-0000-4000-8000-000000000005','Mudanzas','mudanzas',2);


-- Diccionario curado. Sin INSERT/UPDATE/DELETE desde clientes ni coincidencias
-- aproximadas: un término alternativo corresponde a una expresión completa.
create table private.service_category_search_terms (
  category_id uuid not null references public.service_categories(id) on delete restrict,
  term text not null check(length(btrim(term)) between 2 and 160 and term !~ '[[:cntrl:]]'),
  term_normalized text generated always as(private.normalize_search_query(term)) stored,
  active boolean not null default true,
  primary key(category_id,term_normalized),
  check(length(private.normalize_search_query(term)) between 2 and 160)
);
create index service_category_search_term_lookup_idx
  on private.service_category_search_terms(term_normalized,category_id) where active;
alter table private.service_category_search_terms enable row level security;
revoke all on private.service_category_search_terms from public,anon,authenticated;
-- Las claves de categoría se verifican por FK; esta semilla falla si cambia un slug.
insert into private.service_category_search_terms(category_id,term)
select (select id from public.service_categories where slug=seed.slug),seed.term
from (values
  ('albanileria','albañil'),
  ('albanileria','albañiles'),
  ('electricidad','electricista'),
  ('electricidad','electricistas'),
  ('plomeria','plomero'),
  ('plomeria','plomeros'),
  ('plomeria','fontanero'),
  ('plomeria','fontaneros'),
  ('pintura','pintor'),
  ('pintura','pintores'),
  ('carpinteria','carpintero'),
  ('carpinteria','carpinteros'),
  ('herreria','herrero'),
  ('herreria','herreros'),
  ('jardineria','jardinero'),
  ('jardineria','jardineros'),
  ('corte-pasto','cortar pasto'),
  ('corte-pasto','cortar el pasto'),
  ('corte-pasto','cortar césped'),
  ('corte-pasto','cortar el césped'),
  ('corte-pasto','corte de césped'),
  ('limpieza','personal de limpieza'),
  ('limpieza','limpieza de casas'),
  ('mantenimiento-piletas','limpieza de piletas'),
  ('mantenimiento-piletas','limpiar pileta'),
  ('mantenimiento-piletas','limpiar piletas'),
  ('electrodomesticos','arreglar lavarropas'),
  ('electrodomesticos','reparar lavarropas'),
  ('electrodomesticos','reparación de lavarropas'),
  ('electrodomesticos','arreglo de lavarropas'),
  ('electrodomesticos','arreglar heladera'),
  ('electrodomesticos','reparar heladera'),
  ('electrodomesticos','reparación de heladeras'),
  ('electrodomesticos','técnico de electrodomésticos'),
  ('computadoras','técnico informático'),
  ('computadoras','técnico de computadoras'),
  ('computadoras','reparar computadora'),
  ('computadoras','arreglar computadora'),
  ('celulares','reparar celular'),
  ('celulares','arreglar celular'),
  ('celulares','reparación de celulares'),
  ('mecanica-automotor','mecánico'),
  ('mecanica-automotor','mecánicos'),
  ('mecanica-automotor','mecánico automotor'),
  ('aire-acondicionado','instalar aire acondicionado'),
  ('aire-acondicionado','instalador de aire acondicionado'),
  ('aire-acondicionado','reparar aire acondicionado'),
  ('clases-particulares','profe particular'),
  ('clases-particulares','profesor particular'),
  ('clases-particulares','profesora particular'),
  ('clases-particulares','profesores particulares'),
  ('clases-particulares','clase particular'),
  ('apoyo-escolar','ayuda escolar'),
  ('idiomas','clases de idiomas'),
  ('fletes','fletero'),
  ('fletes','fleteros'),
  ('mudanzas','servicio de mudanza')
) as seed(slug,term);

create table public.service_providers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete restrict,
  display_name text not null check(length(btrim(display_name)) between 1 and 120 and display_name !~ '[[:cntrl:]]'),
  description text not null default '' check(length(description)<=5000),
  avatar_path text,
  active boolean not null default true,
  admin_blocked_at timestamptz,
  admin_blocked_by uuid references auth.users(id) on delete restrict,
  admin_block_reason text,
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  search_document tsvector generated always as(to_tsvector('pg_catalog.simple'::regconfig,private.normalize_search_query(display_name||' '||description))) stored,
  constraint service_provider_block check (
    (admin_blocked_at is null and admin_blocked_by is null and admin_block_reason is null)
    or (admin_blocked_at is not null and admin_blocked_by is not null and length(btrim(admin_block_reason)) between 1 and 500 and admin_block_reason is not null)
  ),
  check(avatar_path is null or (avatar_path ~ '^providers/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$' and split_part(avatar_path,'/',2)=id::text)),
  check(updated_at>=created_at)
);
create table private.service_provider_locations (
  provider_id uuid primary key references public.service_providers(id) on delete cascade,
  city text not null check(length(btrim(city)) between 1 and 120 and city !~ '[[:cntrl:]]'),
  province_code text not null,
  province text not null,
  country_code text not null default 'AR' check(country_code='AR'),
  check(private.normalize_search_query(city)<>''),
  check(private.argentina_province_name(province_code) is not null and province=private.argentina_province_name(province_code))
);
-- No domicilio/GPS. Ubicación de referencia NO determina la cobertura.
create table private.service_provider_contacts (
  provider_id uuid primary key references public.service_providers(id) on delete cascade,
  method text not null default 'NONE' check(method in ('NONE','WHATSAPP')),
  whatsapp text,
  consent_at timestamptz,
  check((method='NONE' and whatsapp is null and consent_at is null)
    or (method='WHATSAPP' and whatsapp is not null and whatsapp ~ '^\+54(9)?[1-9][0-9]{9}$' and consent_at is not null))
);
create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  city text not null check(length(btrim(city)) between 1 and 120 and city !~ '[[:cntrl:]]'),
  city_normalized text generated always as(private.normalize_search_query(city)) stored,
  province_code text not null,
  province text not null,
  country_code text not null default 'AR' check(country_code='AR'),
  coverage_type text not null default 'LOCALITY' check(coverage_type='LOCALITY'),
  check(private.normalize_search_query(city)<>''),
  check(private.argentina_province_name(province_code) is not null and province=private.argentina_province_name(province_code)),
  unique(provider_id,province_code,city_normalized)
);
-- Radio futuro requerirá delta explícito; no existen coordenadas ni centroides ficticios.
create table public.service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete restrict,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  title text not null check(length(btrim(title)) between 1 and 160 and title !~ '[[:cntrl:]]'),
  description text not null default '' check(length(description)<=5000),
  service_mode text not null check(service_mode in ('ONSITE','AT_PROVIDER','REMOTE')),
  pricing_mode text not null check(pricing_mode in ('FIXED','FROM','QUOTE')),
  price numeric(12,2),
  currency text not null default 'ARS' check(currency='ARS'),
  status text not null default 'DRAFT' check(status in ('DRAFT','PUBLISHED','PAUSED','WITHDRAWN')),
  accepting_inquiries boolean not null default true,
  published_at timestamptz,
  admin_blocked_at timestamptz,
  admin_blocked_by uuid references auth.users(id) on delete restrict,
  admin_block_reason text,
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  search_document tsvector generated always as(to_tsvector('pg_catalog.simple'::regconfig,private.normalize_search_query(title||' '||description))) stored,
  check((pricing_mode='QUOTE' and price is null) or (pricing_mode in ('FIXED','FROM') and price is not null and price>0 and price<=9999999999.99)),
  check(status<>'PUBLISHED' or published_at is not null),
  check(updated_at>=created_at and (published_at is null or published_at>=created_at)),
  constraint service_listing_block check (
    (admin_blocked_at is null and admin_blocked_by is null and admin_block_reason is null)
    or (admin_blocked_at is not null and admin_blocked_by is not null and admin_block_reason is not null and length(btrim(admin_block_reason)) between 1 and 500)
  )
);
alter table public.service_listings add constraint service_listing_provider_identity unique(id,provider_id);
create table public.service_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  object_path text not null unique,
  position smallint not null check(position between 0 and 4),
  created_at timestamptz not null default clock_timestamp(),
  check(object_path ~ '^listings/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|webp)$' and split_part(object_path,'/',2)=listing_id::text),
  unique(listing_id,position)
);
create index service_categories_parent_idx on public.service_categories(parent_id,position,id);
create index service_listing_provider_idx on public.service_listings(provider_id,created_at desc,id desc);
-- El conteo de cupo no recorre una historia ilimitada de publicaciones retiradas.
create index service_listing_active_quota_idx on public.service_listings(provider_id) where status<>'WITHDRAWN';
create index service_listing_public_idx on public.service_listings(published_at desc,id desc) where status='PUBLISHED' and admin_blocked_at is null;
create index service_listing_category_idx on public.service_listings(category_id,published_at desc,id desc) where status='PUBLISHED' and admin_blocked_at is null;
create index service_listing_search_idx on public.service_listings using gin(search_document);
create index service_area_lookup_idx on public.service_areas(province_code,city_normalized,provider_id);
create index service_provider_date_idx on public.service_providers(created_at desc,id desc);
create index service_provider_search_idx on public.service_providers using gin(search_document);

-- Sin DML directo de cliente; sólo RPC. Incluso el primer delta queda cerrado.
alter table public.service_categories enable row level security;
alter table public.service_providers enable row level security;
alter table public.service_listings enable row level security;
alter table public.service_listing_images enable row level security;
alter table public.service_areas enable row level security;
alter table private.service_provider_contacts enable row level security;
alter table private.service_provider_locations enable row level security;
revoke all on public.service_categories,public.service_providers,public.service_listings,public.service_listing_images,public.service_areas,
  private.service_provider_contacts,private.service_provider_locations from public,anon,authenticated;

create function private.guard_service_parent() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_provider_blocked boolean; v_admin_change boolean;
begin
  if new.id is distinct from old.id or new.created_at is distinct from old.created_at then
    raise exception 'SERVICE_IMMUTABLE_FIELD' using errcode='22023';
  end if;
  if tg_table_name='service_providers' then
    if new.owner_id is distinct from old.owner_id then raise exception 'SERVICE_IMMUTABLE_FIELD' using errcode='22023'; end if;
  else
    if new.provider_id is distinct from old.provider_id then raise exception 'SERVICE_IMMUTABLE_FIELD' using errcode='22023'; end if;
    if new.status is distinct from old.status and not (
      (old.status='DRAFT' and new.status in ('PUBLISHED','WITHDRAWN'))
      or (old.status='PUBLISHED' and new.status in ('PAUSED','WITHDRAWN'))
      or (old.status='PAUSED' and new.status in ('PUBLISHED','WITHDRAWN'))
    ) then raise exception 'SERVICE_INVALID_TRANSITION' using errcode='22023'; end if;
  end if;
  v_admin_change:=row(new.admin_blocked_at,new.admin_blocked_by,new.admin_block_reason)
    is distinct from row(old.admin_blocked_at,old.admin_blocked_by,old.admin_block_reason);
  if auth.uid() is not null then
    if v_admin_change then
      perform private.require_admin();
    else
      perform private.require_active_marketplace_user();
      if tg_table_name='service_providers' then v_owner:=old.owner_id; v_provider_blocked:=false;
      else select owner_id,admin_blocked_at is not null into v_owner,v_provider_blocked from public.service_providers where id=old.provider_id; end if;
      if v_owner is null or v_owner<>auth.uid() then raise exception 'SERVICE_NOT_OWNED' using errcode='42501'; end if;
      if old.admin_blocked_at is not null or v_provider_blocked then raise exception 'SERVICE_BLOCKED' using errcode='42501'; end if;
    end if;
  end if;
  new.revision:=old.revision+1; new.updated_at:=clock_timestamp();
  return new;
end;
$$;
revoke all on function private.guard_service_parent() from public,anon,authenticated;
create trigger service_provider_revision before update on public.service_providers for each row execute function private.guard_service_parent();
create trigger service_listing_revision before update on public.service_listings for each row execute function private.guard_service_parent();

-- Valida el estado final de la transacción. Desactivar/bloquear sigue siendo posible.
create function private.check_service_publication() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_provider uuid; v_bad boolean;
begin
  if tg_table_name='service_providers' then v_provider:=new.id;
  elsif tg_table_name='service_listings' then v_provider:=new.provider_id;
  elsif tg_table_name='service_listing_images' then
    select provider_id into v_provider from public.service_listings where id=case when tg_op='DELETE' then old.listing_id else new.listing_id end;
  else v_provider:=case when tg_op='DELETE' then old.provider_id else new.provider_id end;
  end if;
  select exists(
    select 1 from public.service_listings l join public.service_providers p on p.id=l.provider_id
    where p.id=v_provider and p.active and p.admin_blocked_at is null and l.status='PUBLISHED' and l.admin_blocked_at is null
    and (not exists(select 1 from private.service_provider_locations where provider_id=p.id)
      or not exists(select 1 from private.service_provider_contacts where provider_id=p.id and method='WHATSAPP' and consent_at is not null)
      or not exists(select 1 from public.service_areas where provider_id=p.id)
      or exists(select 1 from public.service_listing_images i where i.listing_id=l.id and not exists(
        select 1 from storage.objects o where o.bucket_id='service-images' and o.name=i.object_path)))
  ) into v_bad;
  if v_bad then raise exception 'SERVICE_PUBLISH_REQUIREMENTS' using errcode='22023'; end if;
  return null;
end;
$$;
revoke all on function private.check_service_publication() from public,anon,authenticated;
create constraint trigger service_providers_publication_check after insert or update on public.service_providers
  deferrable initially deferred for each row execute function private.check_service_publication();
create constraint trigger service_listings_publication_check after insert or update on public.service_listings
  deferrable initially deferred for each row execute function private.check_service_publication();
create constraint trigger service_listing_images_publication_check after insert or update or delete on public.service_listing_images
  deferrable initially deferred for each row execute function private.check_service_publication();
create constraint trigger service_areas_publication_check after insert or update or delete on public.service_areas
  deferrable initially deferred for each row execute function private.check_service_publication();
create constraint trigger service_provider_contacts_publication_check after insert or update or delete on private.service_provider_contacts
  deferrable initially deferred for each row execute function private.check_service_publication();
create constraint trigger service_provider_locations_publication_check after insert or update or delete on private.service_provider_locations
  deferrable initially deferred for each row execute function private.check_service_publication();

commit;


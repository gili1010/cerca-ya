-- CercaYa 2.0: base independiente de publicaciones particulares.
-- Ejecutar MANUALMENTE una vez, como postgres. No ejecutar desde la aplicación.
-- Orden: este archivo -> personal-listings-access.sql -> community-moderation.sql.
-- No modifica tablas, datos, RPC ni policies comerciales.
begin;

-- Fallar antes de crear recursos si el proyecto remoto no tiene los prerrequisitos.
do $$
begin
  if to_regclass('public.profiles') is null or to_regclass('public.categories') is null
    or to_regclass('private.user_suspensions') is null
    or to_regprocedure('private.normalize_search_query(text)') is null
    or to_regprocedure('private.argentina_province_name(text)') is null
    or to_regprocedure('private.require_active_marketplace_user()') is null
    or to_regprocedure('private.require_admin()') is null
    or to_regprocedure('public.is_my_account_suspended()') is null
    or to_regclass('storage.objects') is null or to_regclass('storage.buckets') is null
    or not exists(select 1 from pg_proc where oid=to_regprocedure('private.normalize_search_query(text)') and provolatile='i') then
    raise exception 'PERSONAL_LISTINGS_PREREQUISITES_MISSING';
  end if;
end;
$$;

create table public.personal_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 160 and title !~ '[[:cntrl:]]'),
  description text not null default '' check (length(description) <= 5000),
  price numeric(12,2) not null check (price between 0 and 9999999999.99),
  currency text not null default 'ARS' check (currency = 'ARS'),
  negotiable boolean not null default false,
  item_condition text not null check (item_condition in ('NEW','USED')),
  status text not null default 'DRAFT' check (status in ('DRAFT','PUBLISHED','PAUSED','SOLD','WITHDRAWN')),
  seller_display_name text not null default '' check (length(seller_display_name) <= 120 and seller_display_name !~ '[[:cntrl:]]'),
  contact_method text not null default 'NONE' check (contact_method in ('NONE','WHATSAPP')),
  contact_whatsapp text,
  contact_consent_at timestamptz,
  admin_blocked_at timestamptz,
  admin_blocked_by uuid references auth.users(id) on delete restrict,
  admin_block_reason text check (length(admin_block_reason) <= 500),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  published_at timestamptz,
  expires_at timestamptz,
  revision bigint not null default 1 check (revision > 0),
  search_document tsvector generated always as (
    to_tsvector('pg_catalog.simple'::regconfig, private.normalize_search_query(title || ' ' || description))
  ) stored,
  constraint personal_listing_contact_consistent check (
    (contact_method='NONE' and contact_whatsapp is null and contact_consent_at is null)
    or (contact_method='WHATSAPP' and contact_whatsapp is not null
      and contact_whatsapp ~ '^\+54(9)?[1-9][0-9]{9}$' and contact_consent_at is not null)
  ),
  constraint personal_listing_block_consistent check (
    (admin_blocked_at is null and admin_blocked_by is null and admin_block_reason is null)
    or (admin_blocked_at is not null and admin_blocked_by is not null and admin_block_reason is not null
      and length(btrim(admin_block_reason)) between 1 and 500)
  ),
  constraint personal_listing_published_date check (status <> 'PUBLISHED' or published_at is not null),
  constraint personal_listing_dates check (
    updated_at >= created_at and (published_at is null or published_at >= created_at)
    and (expires_at is null or (isfinite(expires_at) and expires_at > created_at))
  )
);

-- Sólo localidad/provincia/país en esta etapa. Columnas GPS reservadas y sin RPC de escritura.
-- No hay domicilio ni punto público aproximado, ni se usa esta tabla para distancias.
create table private.personal_listing_locations (
  listing_id uuid primary key references public.personal_listings(id) on delete cascade,
  city text not null check (length(btrim(city)) between 1 and 120 and city !~ '[[:cntrl:]]'),
  city_normalized text generated always as (private.normalize_search_query(city)) stored,
  province_code text not null,
  province text not null,
  country_code text not null default 'AR' check (country_code='AR'),
  latitude double precision,
  longitude double precision,
  location_precision text not null default 'NONE' check (location_precision in ('NONE','DEVICE','ADDRESS')),
  updated_at timestamptz not null default clock_timestamp(),
  constraint personal_listing_province_canonical check (
    private.argentina_province_name(province_code) is not null
    and province = private.argentina_province_name(province_code)
  ),
  constraint personal_listing_coordinates_consistent check (
    (latitude is null and longitude is null and location_precision='NONE')
    or (latitude between -90 and 90 and longitude between -180 and 180
      and latitude is not null and longitude is not null and location_precision <> 'NONE')
  )
);

create table public.personal_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.personal_listings(id) on delete cascade,
  object_path text not null unique,
  position smallint not null check (position between 0 and 4),
  created_at timestamptz not null default clock_timestamp(),
  constraint personal_listing_image_path check (
    object_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$'
    and split_part(object_path,'/',1)=listing_id::text
  ),
  constraint personal_listing_image_position unique(listing_id,position)
);
-- position=0 es siempre la imagen principal; no se duplican banderas is_primary.

create index personal_listings_owner_date_idx on public.personal_listings(owner_id,created_at desc,id desc);
create index personal_listings_owner_status_idx on public.personal_listings(owner_id,status,created_at desc,id desc);
create index personal_listings_public_date_idx on public.personal_listings(status,published_at desc,id desc)
  where admin_blocked_at is null;
create index personal_listings_public_category_idx on public.personal_listings(category_id,status,published_at desc,id desc)
  where admin_blocked_at is null;
create index personal_listings_search_idx on public.personal_listings using gin(search_document);
create index personal_listing_locality_idx on private.personal_listing_locations(country_code,province_code,city_normalized,listing_id);

-- Base cerrada incluso si sólo se ejecuta el primer archivo. Authenticated tendrá
-- SELECT propio en el segundo; INSERT/UPDATE/DELETE se realizan exclusivamente por RPC.
alter table public.personal_listings enable row level security;
alter table public.personal_listing_images enable row level security;
alter table private.personal_listing_locations enable row level security;
revoke all on public.personal_listings,public.personal_listing_images,private.personal_listing_locations
  from public,anon,authenticated;

-- Invariantes a nivel DB, no sólo en el cliente o la RPC.
create function private.guard_personal_listing_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_admin_change boolean := false;
begin
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
      or new.created_at is distinct from old.created_at then
      raise exception 'PERSONAL_LISTING_IMMUTABLE_FIELD' using errcode='22023';
    end if;
    v_admin_change := row(new.admin_blocked_at,new.admin_blocked_by,new.admin_block_reason)
      is distinct from row(old.admin_blocked_at,old.admin_blocked_by,old.admin_block_reason);
  end if;
  if auth.uid() is not null then
    if v_admin_change then
      perform private.require_admin();
    else
      perform private.require_active_marketplace_user();
      if (case when tg_op='DELETE' then old.owner_id else new.owner_id end) <> auth.uid() then
        raise exception 'PERSONAL_LISTING_NOT_OWNED' using errcode='42501';
      end if;
      if (tg_op<>'INSERT' and old.admin_blocked_at is not null)
        or (tg_op='INSERT' and new.admin_blocked_at is not null) then
        raise exception 'PERSONAL_LISTING_BLOCKED' using errcode='42501';
      end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  new.title := btrim(regexp_replace(new.title,'[[:space:]]+',' ','g'));
  new.seller_display_name := btrim(new.seller_display_name);
  if tg_op='UPDATE' then
    if new.status is distinct from old.status and not (
      (old.status='DRAFT' and new.status in ('PUBLISHED','WITHDRAWN'))
      or (old.status='PUBLISHED' and new.status in ('PAUSED','SOLD','WITHDRAWN'))
      or (old.status='PAUSED' and new.status in ('PUBLISHED','SOLD','WITHDRAWN'))
    ) then raise exception 'PERSONAL_LISTING_INVALID_TRANSITION' using errcode='22023'; end if;
    new.updated_at := clock_timestamp();
    new.revision := old.revision+1;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_personal_listing_write() from public,anon,authenticated;
create trigger personal_listing_write_guard before insert or update or delete on public.personal_listings
  for each row execute function private.guard_personal_listing_write();

create function private.guard_personal_listing_child_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_listing public.personal_listings%rowtype; v_id uuid;
begin
  v_id := case when tg_op='DELETE' then old.listing_id else new.listing_id end;
  if tg_op='UPDATE' and new.listing_id is distinct from old.listing_id then
    raise exception 'PERSONAL_LISTING_IMMUTABLE_FIELD' using errcode='22023';
  end if;
  select * into v_listing from public.personal_listings where id=v_id for update;
  if auth.uid() is not null then
    perform private.require_active_marketplace_user();
    if v_listing.id is null or v_listing.owner_id <> auth.uid() then
      raise exception 'PERSONAL_LISTING_NOT_OWNED' using errcode='42501';
    end if;
    if v_listing.admin_blocked_at is not null then
      raise exception 'PERSONAL_LISTING_BLOCKED' using errcode='42501';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  if tg_table_name='personal_listing_locations' then
    new.city := btrim(regexp_replace(new.city,'[[:space:]]+',' ','g'));
    new.updated_at := clock_timestamp();
  end if;
  return new;
end;
$$;
revoke all on function private.guard_personal_listing_child_write() from public,anon,authenticated;
create trigger personal_listing_images_write_guard before insert or update or delete on public.personal_listing_images
  for each row execute function private.guard_personal_listing_child_write();
create trigger personal_listing_location_write_guard before insert or update or delete on private.personal_listing_locations
  for each row execute function private.guard_personal_listing_child_write();

-- Diferido: permite cambiar el conjunto de imágenes en una transacción y valida
-- el resultado final. Una publicación PUBLISHED siempre tiene 1..5 fotos reales,
-- principal en posición 0, localidad y contacto consentido.
create function private.check_personal_listing_publication() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_listing public.personal_listings%rowtype; v_count integer;
begin
  if tg_table_name='personal_listings' then
    v_id := case when tg_op='DELETE' then old.id else new.id end;
  else
    v_id := case when tg_op='DELETE' then old.listing_id else new.listing_id end;
  end if;
  select * into v_listing from public.personal_listings where id=v_id;
  -- Bloquear debe ser posible incluso si un archivo fue retirado por operación
  -- privilegiada. Desbloquear PUBLISHED vuelve a exigir todos los requisitos.
  if not found or v_listing.status<>'PUBLISHED' or v_listing.admin_blocked_at is not null then return null; end if;
  select count(*) into v_count from public.personal_listing_images i where i.listing_id=v_id;
  if v_count not between 1 and 5
    or not exists(select 1 from public.personal_listing_images where listing_id=v_id and position=0)
    or exists(select 1 from public.personal_listing_images i where i.listing_id=v_id
      and not exists(select 1 from storage.objects o where o.bucket_id='personal-listing-images' and o.name=i.object_path))
    or not exists(select 1 from private.personal_listing_locations where listing_id=v_id)
    or v_listing.contact_method<>'WHATSAPP' or v_listing.contact_consent_at is null then
    raise exception 'PERSONAL_LISTING_PUBLISH_REQUIREMENTS' using errcode='22023';
  end if;
  return null;
end;
$$;
revoke all on function private.check_personal_listing_publication() from public,anon,authenticated;
create constraint trigger personal_listing_publication_valid after insert or update on public.personal_listings
  deferrable initially deferred for each row execute function private.check_personal_listing_publication();
create constraint trigger personal_listing_images_publication_valid after insert or update or delete on public.personal_listing_images
  deferrable initially deferred for each row execute function private.check_personal_listing_publication();
create constraint trigger personal_listing_location_publication_valid after insert or update or delete on private.personal_listing_locations
  deferrable initially deferred for each row execute function private.check_personal_listing_publication();

commit;

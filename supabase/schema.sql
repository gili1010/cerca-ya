-- CercaYa: INITIAL schema for a NEW Supabase project. Run manually once.
-- Not a migration of the former stores/products draft or of localStorage.
-- No DROP TABLE, no auth-user creation, no local data conversion.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.stock_status as enum ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'UNCONFIRMED');
create type public.request_needed_when as enum ('TODAY', 'TOMORROW', 'THIS_WEEK', 'FLEXIBLE');
create type public.request_status as enum ('OPEN', 'CLOSED', 'CANCELLED', 'EXPIRED');
create type public.offer_status as enum ('ACTIVE', 'WITHDRAWN', 'ACCEPTED', 'REJECTED', 'EXPIRED');
create type public.delivery_type as enum ('PICKUP', 'DELIVERY');
create type public.reservation_status as enum ('PENDING', 'CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED', 'EXPIRED');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text not null default '',
  whatsapp text,
  address text,
  city text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  delivery_radius_km numeric(6,2) not null default 0 check (delivery_radius_km between 0 and 9999),
  delivery_price numeric(12,2) not null default 0 check (delivery_price between 0 and 9999999999.99),
  minimum_order numeric(12,2) not null default 0 check (minimum_order between 0 and 9999999999.99),
  verified boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint businesses_coordinates_pair check ((latitude is null) = (longitude is null))
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  parent_id uuid references public.categories(id) on delete restrict,
  icon text,
  created_at timestamptz not null default now(),
  constraint categories_not_self_parent check (parent_id is distinct from id)
);

create table public.business_categories (
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  primary key (business_id, category_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  brand text,
  model text,
  sku text,
  price numeric(12,2) not null check (price between 0 and 9999999999.99),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  stock_status public.stock_status not null default 'UNCONFIRMED',
  stock_confirmed_at timestamptz,
  pickup_enabled boolean not null default true,
  delivery_enabled boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_id_business_key unique (id, business_id),
  constraint products_business_sku_key unique (business_id, sku)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null check (length(trim(url)) > 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 120),
  description text not null default '' check (length(description) <= 1000),
  category_id uuid not null references public.categories(id) on delete restrict,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  radius_km numeric(6,2) not null default 5 check (radius_km > 0 and radius_km <= 9999),
  needed_when public.request_needed_when not null default 'FLEXIBLE',
  image_url text,
  status public.request_status not null default 'OPEN',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  constraint requests_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint requests_expiry_after_creation check (expires_at > created_at)
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  product_id uuid,
  product_name text not null check (length(trim(product_name)) between 3 and 120),
  description text not null check (length(trim(description)) between 3 and 1000),
  price numeric(12,2) not null check (price > 0 and price <= 9999999999.99),
  pickup_available boolean not null default true,
  delivery_available boolean not null default false,
  delivery_price numeric(12,2) not null default 0 check (delivery_price between 0 and 9999999999.99),
  estimated_delivery text not null default '',
  alternative boolean not null default false,
  status public.offer_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  -- Editing updates this row; it never requires another identical offer.
  constraint offers_request_business_key unique (request_id, business_id),
  constraint offers_product_business_fkey foreign key (product_id, business_id)
    references public.products(id, business_id) on delete restrict,
  constraint offers_delivery_method check (pickup_available or delivery_available),
  constraint offers_delivery_estimate check (not delivery_available or length(trim(estimated_delivery)) between 1 and 120),
  constraint offers_no_delivery_charge check (delivery_available or delivery_price = 0)
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  business_id uuid not null references public.businesses(id) on delete restrict,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price between 0 and 9999999999.99),
  delivery_price numeric(12,2) not null default 0 check (delivery_price between 0 and 9999999999.99),
  total numeric(22,2) generated always as (quantity::numeric * unit_price + delivery_price) stored,
  delivery_type public.delivery_type not null,
  status public.reservation_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  confirmed_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint reservations_product_business_fkey foreign key (product_id, business_id)
    references public.products(id, business_id) on delete restrict,
  constraint reservations_pickup_no_charge check (delivery_type <> 'PICKUP' or delivery_price = 0),
  constraint reservations_expiry_after_creation check (expires_at > created_at),
  constraint reservations_confirmation_required check (status not in ('CONFIRMED', 'READY', 'COMPLETED') or confirmed_at is not null),
  constraint reservations_ready_required check (status not in ('READY', 'COMPLETED') or ready_at is not null),
  constraint reservations_completion_required check (status <> 'COMPLETED' or completed_at is not null),
  constraint reservations_cancellation_required check (status <> 'CANCELLED' or cancelled_at is not null),
  constraint reservations_confirmed_date check (confirmed_at is null or confirmed_at >= created_at),
  constraint reservations_ready_date check (ready_at is null or (confirmed_at is not null and ready_at >= confirmed_at)),
  constraint reservations_completed_date check (completed_at is null or (ready_at is not null and completed_at >= ready_at)),
  constraint reservations_cancelled_date check (cancelled_at is null or cancelled_at >= created_at)
);

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  query text not null check (length(trim(query)) between 1 and 500),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  results_count integer not null default 0 check (results_count >= 0),
  created_at timestamptz not null default now(),
  constraint search_events_coordinates_pair check ((latitude is null) = (longitude is null))
);

-- Deliberately basic indexes. No GIS or search extensions in this stage.
create index businesses_owner_id_idx on public.businesses(owner_id);
create index categories_parent_id_idx on public.categories(parent_id);
create index business_categories_category_id_idx on public.business_categories(category_id);
create index products_name_idx on public.products(name);
create index products_business_id_idx on public.products(business_id);
create index products_category_id_idx on public.products(category_id);
create index requests_status_idx on public.requests(status);
create index requests_category_id_idx on public.requests(category_id);
create index requests_buyer_id_idx on public.requests(buyer_id);
-- UNIQUE(request_id, business_id) already indexes offers.request_id as its leading column.
create index offers_business_id_idx on public.offers(business_id);
create index offers_product_id_idx on public.offers(product_id);
create index reservations_buyer_id_idx on public.reservations(buyer_id);
create index reservations_business_id_idx on public.reservations(business_id);
create index reservations_status_idx on public.reservations(status);
create index reservations_product_id_idx on public.reservations(product_id);
create index favorites_product_id_idx on public.favorites(product_id);
create index search_events_created_at_idx on public.search_events(created_at);
create index search_events_user_id_idx on public.search_events(user_id);

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger profiles_updated_at before update on public.profiles for each row execute function private.touch_updated_at();
create trigger businesses_updated_at before update on public.businesses for each row execute function private.touch_updated_at();
create trigger products_updated_at before update on public.products for each row execute function private.touch_updated_at();

-- Private predicates avoid recursive RLS and do not return customer information.
-- Keep the private schema OUT of the Data API exposed schemas.
create function private.owns_business(target_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses b where b.id = target_id and b.owner_id = (select auth.uid()));
$$;
create function private.can_offer(target_request uuid, target_business uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.requests r, public.businesses b
    where r.id = target_request and r.status = 'OPEN' and r.expires_at > now()
      and b.id = target_business and b.active and b.owner_id = (select auth.uid())
  );
$$;
-- Physical distance validation belongs to the future coarse-location/Radar API.
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.owns_business(uuid) from public, anon, authenticated;
revoke all on function private.can_offer(uuid, uuid) from public, anon, authenticated;
grant execute on function private.owns_business(uuid) to authenticated;
grant execute on function private.can_offer(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.categories enable row level security;
alter table public.business_categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.requests enable row level security;
alter table public.offers enable row level security;
alter table public.reservations enable row level security;
alter table public.favorites enable row level security;
alter table public.search_events enable row level security;

-- Start from explicit grants, regardless of the project's default table privileges.
revoke all on public.profiles, public.businesses, public.categories, public.business_categories,
  public.products, public.product_images, public.requests, public.offers, public.reservations,
  public.favorites, public.search_events from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.businesses, public.categories, public.business_categories, public.products, public.product_images to anon, authenticated;
grant select on public.profiles, public.requests, public.offers, public.reservations, public.favorites, public.search_events to authenticated;

grant insert (id, full_name, phone, avatar_url), update (full_name, phone, avatar_url) on public.profiles to authenticated;
grant insert (owner_id, name, slug, description, whatsapp, address, city, latitude, longitude, pickup_enabled, delivery_enabled, delivery_radius_km, delivery_price, minimum_order),
  update (name, slug, description, whatsapp, address, city, latitude, longitude, pickup_enabled, delivery_enabled, delivery_radius_km, delivery_price, minimum_order, active) on public.businesses to authenticated;
-- verified and ownership changes are administrative, not client-controlled.
grant insert, delete on public.business_categories to authenticated;
grant insert (business_id, category_id, name, description, brand, model, sku, price, stock_quantity, stock_status, stock_confirmed_at, pickup_enabled, delivery_enabled, active),
  update (category_id, name, description, brand, model, sku, price, stock_quantity, stock_status, stock_confirmed_at, pickup_enabled, delivery_enabled, active) on public.products to authenticated;
grant insert (product_id, url, position), update (url, position), delete on public.product_images to authenticated;
grant insert (buyer_id, title, description, category_id, latitude, longitude, radius_km, needed_when, image_url), update (status) on public.requests to authenticated;
grant insert (request_id, business_id, product_id, product_name, description, price, pickup_available, delivery_available, delivery_price, estimated_delivery, alternative),
  update (product_id, product_name, description, price, pickup_available, delivery_available, delivery_price, estimated_delivery, alternative, status) on public.offers to authenticated;
grant insert (user_id, product_id), delete on public.favorites to authenticated;
grant insert (user_id, query, latitude, longitude, results_count) on public.search_events to authenticated;
grant insert (buyer_id, business_id, product_id, quantity, unit_price, delivery_price, delivery_type) on public.reservations to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_create_own on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy businesses_read_active on public.businesses for select to anon, authenticated using (active);
create policy businesses_read_own on public.businesses for select to authenticated using (owner_id = (select auth.uid()));
create policy businesses_create_own on public.businesses for insert to authenticated with check (owner_id = (select auth.uid()) and not verified);
create policy businesses_update_own on public.businesses for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
create policy business_categories_read on public.business_categories for select to anon, authenticated using (exists (select 1 from public.businesses b where b.id = business_id));
create policy business_categories_insert_own on public.business_categories for insert to authenticated with check (private.owns_business(business_id));
create policy business_categories_delete_own on public.business_categories for delete to authenticated using (private.owns_business(business_id));

create policy products_public_read on public.products for select to anon, authenticated using (active and exists (select 1 from public.businesses b where b.id = business_id and b.active));
create policy products_owner_read on public.products for select to authenticated using (private.owns_business(business_id));
create policy products_owner_insert on public.products for insert to authenticated with check (private.owns_business(business_id));
create policy products_owner_update on public.products for update to authenticated using (private.owns_business(business_id)) with check (private.owns_business(business_id));
create policy images_read on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id));
create policy images_owner_insert on public.product_images for insert to authenticated with check (exists (select 1 from public.products p where p.id = product_id and private.owns_business(p.business_id)));
create policy images_owner_update on public.product_images for update to authenticated using (exists (select 1 from public.products p where p.id = product_id and private.owns_business(p.business_id))) with check (exists (select 1 from public.products p where p.id = product_id and private.owns_business(p.business_id)));
create policy images_owner_delete on public.product_images for delete to authenticated using (exists (select 1 from public.products p where p.id = product_id and private.owns_business(p.business_id)));

-- Raw requests contain precise coordinates: no public or merchant SELECT policy.
-- Later Radar needs a restricted projection/API, never SELECT * on this table.
create policy requests_buyer_read on public.requests for select to authenticated using (buyer_id = (select auth.uid()));
create policy requests_buyer_create on public.requests for insert to authenticated with check (buyer_id = (select auth.uid()) and status = 'OPEN');
create policy requests_buyer_finish on public.requests for update to authenticated
  using (buyer_id = (select auth.uid()) and status = 'OPEN' and expires_at > now())
  with check (buyer_id = (select auth.uid()) and status in ('CLOSED', 'CANCELLED'));

create policy offers_participants_read on public.offers for select to authenticated using (
  private.owns_business(business_id) or exists (select 1 from public.requests r where r.id = request_id and r.buyer_id = (select auth.uid()))
);
create policy offers_business_create on public.offers for insert to authenticated with check (private.can_offer(request_id, business_id) and status = 'ACTIVE');
create policy offers_business_edit on public.offers for update to authenticated
  using (private.can_offer(request_id, business_id) and status = 'ACTIVE')
  with check (private.can_offer(request_id, business_id) and status in ('ACTIVE', 'WITHDRAWN'));

create policy reservations_buyer_read on public.reservations for select to authenticated using (buyer_id = (select auth.uid()));
create policy reservations_business_read on public.reservations for select to authenticated using (private.owns_business(business_id));
-- Pending reservations may be created with catalog prices; no stock is deducted.
-- State changes have ownership policies but NO direct UPDATE grant: transitions,
-- stock deduction/restoration and concurrency need transactional RPCs in a later stage.
create policy reservations_buyer_create on public.reservations for insert to authenticated
  with check (
    buyer_id = (select auth.uid()) and status = 'PENDING'
    and confirmed_at is null and ready_at is null and completed_at is null and cancelled_at is null
    and exists (
      select 1 from public.products p join public.businesses b on b.id = p.business_id
      where p.id = reservations.product_id and b.id = reservations.business_id
        and p.active and b.active and p.stock_quantity >= reservations.quantity
        and reservations.unit_price = p.price
        and (
          (reservations.delivery_type = 'PICKUP' and p.pickup_enabled and b.pickup_enabled and reservations.delivery_price = 0)
          or (reservations.delivery_type = 'DELIVERY' and p.delivery_enabled and b.delivery_enabled and reservations.delivery_price = b.delivery_price)
        )
    )
  );
create policy reservations_buyer_cancel on public.reservations for update to authenticated
  using (buyer_id = (select auth.uid()) and status in ('PENDING', 'CONFIRMED'))
  with check (buyer_id = (select auth.uid()) and status = 'CANCELLED');
create policy reservations_business_manage on public.reservations for update to authenticated
  using (private.owns_business(business_id) and status in ('PENDING', 'CONFIRMED', 'READY'))
  with check (private.owns_business(business_id) and status in ('CONFIRMED', 'READY', 'COMPLETED', 'CANCELLED'));

create policy favorites_read_own on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy favorites_create_own on public.favorites for insert to authenticated with check (user_id = (select auth.uid()) and exists (select 1 from public.products p where p.id = product_id and p.active));
create policy favorites_delete_own on public.favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy searches_read_own on public.search_events for select to authenticated using (user_id = (select auth.uid()));
create policy searches_create_own on public.search_events for insert to authenticated with check (user_id = (select auth.uid()));
-- Anonymous telemetry (user_id NULL) is reserved for a future controlled backend.
-- Businesses never read raw searches or customer coordinates; future analytics aggregate them.

commit;

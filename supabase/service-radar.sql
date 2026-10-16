-- Radar de servicios 1/3. Requiere los tres deltas services ya instalados.
begin;
create table public.service_requests (
 id uuid primary key,
 requester_id uuid not null references public.profiles(id) on delete restrict,
 category_id uuid not null references public.service_categories(id) on delete restrict,
 title text not null check(length(btrim(title)) between 8 and 120),
 description text not null check(length(btrim(description)) between 20 and 2000),
 city text not null check(length(btrim(city)) between 1 and 120 and city !~ '[[:cntrl:]]'),
 city_normalized text generated always as (private.normalize_search_query(city)) stored,
 province_code text not null check(private.argentina_province_name(province_code) is not null),
 country_code text not null default 'AR' check(country_code='AR'),
 status text not null default 'OPEN' check(status in ('OPEN','CLOSED','CANCELLED','EXPIRED')),
 selected_offer_id uuid,
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default (clock_timestamp()+interval '7 days'),
 admin_blocked_at timestamptz,
 admin_blocked_by uuid references auth.users(id) on delete restrict,
 admin_block_reason text check(length(admin_block_reason)<=500),
 check(expires_at>created_at),
 check(city_normalized<>''),
 check(selected_offer_id is null or status='CLOSED'),
 check((admin_blocked_at is null and admin_blocked_by is null and admin_block_reason is null)
   or (admin_blocked_at is not null and admin_blocked_by is not null and admin_block_reason is not null and length(btrim(admin_block_reason))>0))
);
create table public.service_request_offers (
 id uuid primary key,
 request_id uuid not null references public.service_requests(id) on delete restrict,
 provider_id uuid not null references public.service_providers(id) on delete restrict,
 service_listing_id uuid not null,
 message text not null check(length(btrim(message)) between 10 and 1500),
 pricing_mode text not null check(pricing_mode in ('FIXED','FROM','QUOTE')),
 proposed_price numeric(12,2),
 currency text not null default 'ARS' check(currency='ARS'),
 status text not null default 'PENDING' check(status in ('PENDING','ACCEPTED','REJECTED','WITHDRAWN')),
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 admin_blocked_at timestamptz,
 admin_blocked_by uuid references auth.users(id) on delete restrict,
 admin_block_reason text check(length(admin_block_reason)<=500),
 foreign key(service_listing_id,provider_id) references public.service_listings(id,provider_id) on delete restrict,
 unique(request_id,provider_id), unique(id,request_id),
 check((pricing_mode='QUOTE' and proposed_price is null)
   or (pricing_mode in ('FIXED','FROM') and proposed_price is not null and proposed_price>0 and proposed_price<=9999999999.99)),
 check((admin_blocked_at is null and admin_blocked_by is null and admin_block_reason is null)
   or (admin_blocked_at is not null and admin_blocked_by is not null and admin_block_reason is not null and length(btrim(admin_block_reason))>0))
);
alter table public.service_requests add constraint service_request_selected_offer_fk
 foreign key(selected_offer_id,id) references public.service_request_offers(id,request_id) on delete restrict;
create unique index service_request_one_accepted_idx on public.service_request_offers(request_id) where status='ACCEPTED';
create index service_request_radar_idx on public.service_requests(category_id,province_code,city_normalized,created_at desc,id desc)
 where status='OPEN' and admin_blocked_at is null;
create index service_request_expiry_idx on public.service_requests(expires_at) where status='OPEN';
create index service_request_owner_idx on public.service_requests(requester_id,created_at desc,id desc);
create index service_request_status_idx on public.service_requests(status,created_at desc,id desc);
create index service_request_offer_request_idx on public.service_request_offers(request_id,created_at desc,id desc);
create index service_request_offer_provider_idx on public.service_request_offers(provider_id,created_at desc,id desc);
alter table public.service_requests enable row level security;
alter table public.service_request_offers enable row level security;
-- RPC-only: no tabla nueva es legible ni escribible directamente por clientes.
revoke all on public.service_requests,public.service_request_offers from public,anon,authenticated;
create table private.service_radar_write_limits (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null,
 writes integer not null check(writes>0)
);
alter table private.service_radar_write_limits enable row level security;
revoke all on private.service_radar_write_limits from public,anon,authenticated;

create function private.guard_service_radar_row() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.id<>old.id or new.created_at<>old.created_at then raise exception 'SERVICE_RADAR_IMMUTABLE' using errcode='22023'; end if;
 if tg_table_name='service_requests' then
   if new.requester_id<>old.requester_id or new.expires_at<>old.expires_at then raise exception 'SERVICE_RADAR_IMMUTABLE' using errcode='22023'; end if;
   if old.status<>'OPEN' and (new.status<>old.status or row(new.title,new.description,new.category_id,new.city,new.province_code,new.selected_offer_id)
     is distinct from row(old.title,old.description,old.category_id,old.city,old.province_code,old.selected_offer_id)) then
     raise exception 'SERVICE_RADAR_TERMINAL' using errcode='22023';
   end if;
 else
   if row(new.request_id,new.provider_id,new.service_listing_id) is distinct from row(old.request_id,old.provider_id,old.service_listing_id) then
     raise exception 'SERVICE_RADAR_IMMUTABLE' using errcode='22023'; end if;
   if old.status<>'PENDING' and row(new.status,new.message,new.pricing_mode,new.proposed_price)
     is distinct from row(old.status,old.message,old.pricing_mode,old.proposed_price) then
     raise exception 'SERVICE_RADAR_TERMINAL' using errcode='22023'; end if;
 end if;
 new.revision:=old.revision+1; new.updated_at:=clock_timestamp(); return new;
end;
$$;
create trigger guard_service_request before update on public.service_requests for each row execute function private.guard_service_radar_row();
create trigger guard_service_request_offer before update on public.service_request_offers for each row execute function private.guard_service_radar_row();

-- Comprueba el resultado final, después de actualizar solicitud y ofertas atómicamente.
create function private.check_service_radar_selection() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_request public.service_requests%rowtype;
begin
 if tg_table_name='service_requests' then v_id:=new.id; else v_id:=new.request_id; end if;
 select * into v_request from public.service_requests where id=v_id;
 if (v_request.selected_offer_id is not null and not exists(select 1 from public.service_request_offers
     where id=v_request.selected_offer_id and request_id=v_id and status='ACCEPTED'))
   or exists(select 1 from public.service_request_offers where request_id=v_id and status='ACCEPTED'
     and (v_request.status<>'CLOSED' or id is distinct from v_request.selected_offer_id)) then
   raise exception 'SERVICE_RADAR_SELECTION_INVALID' using errcode='23514';
 end if;
 return null;
end;
$$;
create constraint trigger service_request_selection after insert or update on public.service_requests
 deferrable initially deferred for each row execute function private.check_service_radar_selection();
create constraint trigger service_offer_selection after insert or update on public.service_request_offers
 deferrable initially deferred for each row execute function private.check_service_radar_selection();
revoke all on function private.guard_service_radar_row(),private.check_service_radar_selection() from public,anon,authenticated;
commit;

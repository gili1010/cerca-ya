-- Servicios: reportes/moderación propios, sin alterar Admin comercial/particular.
-- Ejecutar manualmente después de services-access.sql.
begin;
create table private.service_reports (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete restrict,
  listing_id uuid references public.service_listings(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check(reason in ('Información incorrecta','Servicio prohibido o inapropiado','Posible estafa','Contenido ofensivo','Otro')),
  details text not null default '' check(length(details)<=1000),
  status text not null default 'OPEN' check(status in ('OPEN','RESOLVED','DISMISSED')),
  revision bigint not null default 1 check(revision>0),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text not null default '' check(length(resolution_note)<=500),
  check((status='OPEN' and resolved_at is null and resolved_by is null)
    or (status<>'OPEN' and resolved_at is not null and resolved_by is not null))
);
create unique index service_report_listing_open_idx on private.service_reports(reporter_user_id,listing_id) where status='OPEN' and listing_id is not null;
alter table private.service_reports add constraint service_report_provider_matches foreign key(listing_id,provider_id) references public.service_listings(id,provider_id) on delete restrict;
create unique index service_report_provider_open_idx on private.service_reports(reporter_user_id,provider_id) where status='OPEN' and listing_id is null;
create index service_report_admin_idx on private.service_reports(status,created_at desc,id desc);
create index service_report_provider_idx on private.service_reports(provider_id,created_at desc,id desc);
create index service_report_listing_idx on private.service_reports(listing_id,created_at desc,id desc);
create index service_report_rate_idx on private.service_reports(reporter_user_id,created_at desc);

create table private.service_audit_logs (
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid not null references auth.users(id) on delete restrict,
 provider_id uuid not null references public.service_providers(id) on delete restrict,
 listing_id uuid references public.service_listings(id) on delete restrict,
 report_id uuid references private.service_reports(id) on delete restrict,
 action text not null check(action in ('PROVIDER_BLOCKED','PROVIDER_UNBLOCKED','SERVICE_BLOCKED','SERVICE_UNBLOCKED','REPORT_RESOLVED','REPORT_DISMISSED')),
 reason text not null default '' check(length(reason)<=500),
 note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default clock_timestamp()
);
create index service_audit_provider_idx on private.service_audit_logs(provider_id,created_at desc,id desc);
alter table private.service_audit_logs add constraint service_audit_provider_matches foreign key(listing_id,provider_id) references public.service_listings(id,provider_id) on delete restrict;
create index service_audit_listing_idx on private.service_audit_logs(listing_id,created_at desc,id desc);
create index service_audit_date_idx on private.service_audit_logs(created_at desc,id desc);
alter table private.service_reports enable row level security;
alter table private.service_audit_logs enable row level security;
revoke all on private.service_reports,private.service_audit_logs from public,anon,authenticated;

create function public.report_service(p_entity text,p_id uuid,p_reason text,p_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_provider uuid; v_listing uuid; v_owner uuid; v_id uuid;
begin
 perform private.require_active_marketplace_user();
 perform pg_advisory_xact_lock(hashtextextended('service-reports:'||auth.uid()::text,0));
 if p_entity is null or p_entity not in ('provider','listing') or p_reason is null
   or p_reason not in ('Información incorrecta','Servicio prohibido o inapropiado','Posible estafa','Contenido ofensivo','Otro')
   or length(coalesce(p_details,''))>1000 then raise exception 'SERVICE_REPORT_INVALID' using errcode='22023'; end if;
 if p_entity='provider' then
   if not private.service_provider_is_public(p_id) then raise exception 'SERVICE_UNAVAILABLE' using errcode='22023'; end if;
   v_provider:=p_id;
 else
   if not private.service_listing_is_public(p_id) then raise exception 'SERVICE_UNAVAILABLE' using errcode='22023'; end if;
   select provider_id into v_provider from public.service_listings where id=p_id; v_listing:=p_id;
 end if;
 select owner_id into v_owner from public.service_providers where id=v_provider;
 if v_owner=auth.uid() then raise exception 'SERVICE_REPORT_INVALID' using errcode='22023'; end if;
 select id into v_id from private.service_reports where reporter_user_id=auth.uid() and provider_id=v_provider
   and listing_id is not distinct from v_listing and status='OPEN';
 if found then return v_id; end if;
 if (select count(*) from private.service_reports where reporter_user_id=auth.uid() and created_at>clock_timestamp()-interval '24 hours')>=10 then
   raise exception 'SERVICE_REPORT_LIMIT' using errcode='22023';
 end if;
 insert into private.service_reports(provider_id,listing_id,reporter_user_id,reason,details) values(v_provider,v_listing,auth.uid(),p_reason,btrim(coalesce(p_details,''))) returning id into v_id;
 return v_id;
end;
$$;
create function public.admin_set_service_block(p_entity text,p_id uuid,p_blocked boolean,p_expected_revision bigint,p_reason text default '',p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_provider public.service_providers%rowtype; v_listing public.service_listings%rowtype; v_provider_id uuid; v_current boolean; v_revision bigint;
begin
 perform private.require_admin();
 if p_entity is null or p_entity not in ('provider','listing') or p_blocked is null or p_expected_revision is null
   or length(btrim(coalesce(p_reason,'')))>500 or length(coalesce(p_note,''))>500 or (p_blocked and btrim(coalesce(p_reason,''))='') then
   raise exception 'SERVICE_MODERATION_INVALID' using errcode='22023';
 end if;
 if p_entity='provider' then v_provider_id:=p_id;
 else select provider_id into v_provider_id from public.service_listings where id=p_id; end if;
 select * into v_provider from public.service_providers where id=v_provider_id for update;
 if not found then raise exception 'SERVICE_UNAVAILABLE' using errcode='22023'; end if;
 if p_entity='provider' then v_revision:=v_provider.revision; v_current:=v_provider.admin_blocked_at is not null;
 else
   select * into v_listing from public.service_listings where id=p_id for update;
   if not found then raise exception 'SERVICE_UNAVAILABLE' using errcode='22023'; end if;
   v_revision:=v_listing.revision; v_current:=v_listing.admin_blocked_at is not null;
 end if;
 if v_revision<>p_expected_revision then raise exception 'SERVICE_CHANGED' using errcode='40001'; end if;
 if v_current=p_blocked then return; end if;
 if p_entity='provider' then
   update public.service_providers set admin_blocked_at=case when p_blocked then clock_timestamp() end,
     admin_blocked_by=case when p_blocked then auth.uid() end,admin_block_reason=case when p_blocked then btrim(p_reason) end where id=p_id;
 else
   update public.service_listings set admin_blocked_at=case when p_blocked then clock_timestamp() end,
     admin_blocked_by=case when p_blocked then auth.uid() end,admin_block_reason=case when p_blocked then btrim(p_reason) end where id=p_id;
 end if;
 -- No cambia active/status/accepting_inquiries. Desbloquear no republica ni elude suspensión.
 insert into private.service_audit_logs(admin_user_id,provider_id,listing_id,action,reason,note)
   values(auth.uid(),v_provider_id,case when p_entity='listing' then p_id end,
     case when p_entity='provider' then case when p_blocked then 'PROVIDER_BLOCKED' else 'PROVIDER_UNBLOCKED' end
       else case when p_blocked then 'SERVICE_BLOCKED' else 'SERVICE_UNBLOCKED' end end,btrim(coalesce(p_reason,'')),btrim(coalesce(p_note,'')));
end;
$$;
create function public.admin_resolve_service_report(p_report_id uuid,p_status text,p_expected_revision bigint,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_report private.service_reports%rowtype;
begin
 perform private.require_admin();
 if p_status is null or p_status not in ('RESOLVED','DISMISSED') or p_expected_revision is null or length(coalesce(p_note,''))>500 then raise exception 'SERVICE_MODERATION_INVALID' using errcode='22023'; end if;
 select * into v_report from private.service_reports where id=p_report_id for update;
 if not found then raise exception 'SERVICE_REPORT_INVALID' using errcode='22023'; end if;
 if v_report.revision<>p_expected_revision then raise exception 'SERVICE_CHANGED' using errcode='40001'; end if;
 if v_report.status<>'OPEN' then return; end if;
 update private.service_reports set status=p_status,resolved_at=clock_timestamp(),resolved_by=auth.uid(),revision=revision+1,resolution_note=btrim(coalesce(p_note,'')) where id=p_report_id;
 insert into private.service_audit_logs(admin_user_id,provider_id,listing_id,report_id,action,note)
   values(auth.uid(),v_report.provider_id,v_report.listing_id,p_report_id,case when p_status='RESOLVED' then 'REPORT_RESOLVED' else 'REPORT_DISMISSED' end,btrim(coalesce(p_note,'')));
end;
$$;
create function public.admin_read_services(p_section text,p_provider_id uuid default null,p_listing_id uuid default null,
 p_status text default null,p_offset integer default 0,p_limit integer default 24)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.require_admin();
 if p_section is null or p_section not in ('providers','listings','reports','audit')
   or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50
   or (p_section='providers' and (p_listing_id is not null or (p_status is not null and p_status not in ('ACTIVE','INACTIVE'))))
   or (p_section='listings' and p_status is not null and p_status not in ('DRAFT','PUBLISHED','PAUSED','WITHDRAWN'))
   or (p_section='reports' and p_status is not null and p_status not in ('OPEN','RESOLVED','DISMISSED'))
   or (p_section='audit' and p_status is not null) then raise exception 'SERVICE_FILTER_INVALID' using errcode='22023'; end if;
 if p_section='providers' then
   with scoped as materialized(select id,created_at from public.service_providers where (p_provider_id is null or id=p_provider_id)
     and (p_status is null or active=(p_status='ACTIVE'))),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_provider_document(id,true) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 elsif p_section='listings' then
   with scoped as materialized(select id,created_at from public.service_listings where (p_provider_id is null or provider_id=p_provider_id)
     and (p_listing_id is null or id=p_listing_id) and (p_status is null or status=p_status)),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_listing_document(id,true) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 elsif p_section='reports' then
   with scoped as materialized(select * from private.service_reports where (p_provider_id is null or provider_id=p_provider_id)
     and (p_listing_id is null or listing_id=p_listing_id) and (p_status is null or status=p_status)),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 else
   with scoped as materialized(select * from private.service_audit_logs where (p_provider_id is null or provider_id=p_provider_id) and (p_listing_id is null or listing_id=p_listing_id)),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 end if;
 return v_result;
end;
$$;
revoke all on function public.report_service(text,uuid,text,text),public.admin_set_service_block(text,uuid,boolean,bigint,text,text),
 public.admin_resolve_service_report(uuid,text,bigint,text),public.admin_read_services(text,uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.report_service(text,uuid,text,text),public.admin_set_service_block(text,uuid,boolean,bigint,text,text),
 public.admin_resolve_service_report(uuid,text,bigint,text),public.admin_read_services(text,uuid,uuid,text,integer,integer) to authenticated;
notify pgrst,'reload schema';
commit;


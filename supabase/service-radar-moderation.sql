-- Radar de servicios 3/3. Reportes y auditoría exclusivos del dominio.
begin;
create table private.service_radar_reports (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.service_requests(id) on delete restrict,
 offer_id uuid,
 reporter_user_id uuid not null references auth.users(id) on delete restrict,
 reason text not null check(reason in ('Información inapropiada','Posible estafa','Contenido ofensivo','Otro')),
 details text not null default '' check(length(details)<=1000),
 status text not null default 'OPEN' check(status in ('OPEN','RESOLVED','DISMISSED')),
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default clock_timestamp(),
 resolved_at timestamptz, resolved_by uuid references auth.users(id) on delete restrict,
 resolution_note text not null default '' check(length(resolution_note)<=500),
 foreign key(offer_id,request_id) references public.service_request_offers(id,request_id) on delete restrict,
 check((status='OPEN' and resolved_at is null and resolved_by is null) or (status<>'OPEN' and resolved_at is not null and resolved_by is not null))
);
create unique index service_radar_report_request_unique on private.service_radar_reports(reporter_user_id,request_id) where offer_id is null and status='OPEN';
create unique index service_radar_report_offer_unique on private.service_radar_reports(reporter_user_id,offer_id) where offer_id is not null and status='OPEN';
create index service_radar_report_rate_idx on private.service_radar_reports(reporter_user_id,created_at desc);
create index service_radar_report_status_idx on private.service_radar_reports(status,created_at desc,id desc);
create index service_radar_report_request_idx on private.service_radar_reports(request_id,created_at desc,id desc);
create index service_radar_report_offer_idx on private.service_radar_reports(offer_id);
create table private.service_radar_audit_logs (
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid not null references auth.users(id) on delete restrict,
 request_id uuid not null references public.service_requests(id) on delete restrict,
 offer_id uuid,
 report_id uuid references private.service_radar_reports(id) on delete restrict,
 action text not null check(action in ('REQUEST_BLOCKED','REQUEST_UNBLOCKED','OFFER_BLOCKED','OFFER_UNBLOCKED','REPORT_RESOLVED','REPORT_DISMISSED')),
 reason text not null default '' check(length(reason)<=500),
 note text not null default '' check(length(note)<=500),
 created_at timestamptz not null default clock_timestamp(),
 foreign key(offer_id,request_id) references public.service_request_offers(id,request_id) on delete restrict
);
create index service_radar_audit_date_idx on private.service_radar_audit_logs(created_at desc,id desc);
create index service_radar_audit_request_idx on private.service_radar_audit_logs(request_id,created_at desc,id desc);
create index service_radar_audit_offer_idx on private.service_radar_audit_logs(offer_id);
alter table private.service_radar_reports enable row level security;
alter table private.service_radar_audit_logs enable row level security;
revoke all on private.service_radar_reports,private.service_radar_audit_logs from public,anon,authenticated;

create function public.report_service_radar(p_entity text,p_id uuid,p_reason text,p_details text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare v_request uuid; v_offer uuid; v_owner uuid; v_provider uuid; v_id uuid; v_access boolean;
begin
 perform private.service_radar_actor();
 if p_entity is null or p_entity not in ('request','offer') or p_reason is null
   or p_reason not in ('Información inapropiada','Posible estafa','Contenido ofensivo','Otro') or length(coalesce(p_details,''))>1000 then
   raise exception 'SERVICE_RADAR_REPORT_INVALID' using errcode='22023'; end if;
 select id into v_provider from public.service_providers where owner_id=auth.uid();
 if p_entity='request' then
   v_request:=p_id;
   select requester_id into v_owner from public.service_requests where id=v_request;
   v_access:=private.service_radar_matches(v_request,v_provider) or exists(select 1 from public.service_request_offers where request_id=v_request and provider_id=v_provider);
 else
   select o.request_id,o.id,p.owner_id into v_request,v_offer,v_owner from public.service_request_offers o
     join public.service_providers p on p.id=o.provider_id where o.id=p_id;
   v_access:=exists(select 1 from public.service_requests where id=v_request and requester_id=auth.uid());
 end if;
 if v_owner is null or v_owner=auth.uid() or not coalesce(v_access,false) then raise exception 'SERVICE_RADAR_NOT_OWNED' using errcode='42501'; end if;
 select id into v_id from private.service_radar_reports where reporter_user_id=auth.uid() and request_id=v_request
   and offer_id is not distinct from v_offer and status='OPEN';
 if found then return v_id; end if;
 if (select count(*) from private.service_radar_reports where reporter_user_id=auth.uid() and created_at>clock_timestamp()-interval '24 hours')>=10 then
   raise exception 'SERVICE_RADAR_LIMIT' using errcode='22023'; end if;
 insert into private.service_radar_reports(request_id,offer_id,reporter_user_id,reason,details)
 values(v_request,v_offer,auth.uid(),p_reason,btrim(coalesce(p_details,''))) returning id into v_id;
 return v_id;
end;
$$;
create function public.admin_set_service_radar_block(p_entity text,p_id uuid,p_blocked boolean,p_expected_revision bigint,p_reason text default '',p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_request uuid; v_revision bigint; v_current boolean;
begin
 perform private.require_admin();
 if p_entity is null or p_entity not in ('request','offer') or p_blocked is null or p_expected_revision is null
   or length(coalesce(p_reason,''))>500 or length(coalesce(p_note,''))>500 or (p_blocked and btrim(coalesce(p_reason,''))='') then
   raise exception 'SERVICE_RADAR_MODERATION_INVALID' using errcode='22023'; end if;
 if p_entity='request' then v_request:=p_id;
 else select request_id into v_request from public.service_request_offers where id=p_id; end if;
 perform id from public.service_requests where id=v_request for update;
 if not found then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 if p_entity='request' then select revision,admin_blocked_at is not null into v_revision,v_current from public.service_requests where id=p_id;
 else select revision,admin_blocked_at is not null into v_revision,v_current from public.service_request_offers where id=p_id for update; end if;
 if v_revision<>p_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
 if v_current=p_blocked then return; end if;
 if p_entity='request' then
   update public.service_requests set admin_blocked_at=case when p_blocked then clock_timestamp() end,
     admin_blocked_by=case when p_blocked then auth.uid() end,admin_block_reason=case when p_blocked then btrim(p_reason) end where id=p_id;
 else
   update public.service_request_offers set admin_blocked_at=case when p_blocked then clock_timestamp() end,
     admin_blocked_by=case when p_blocked then auth.uid() end,admin_block_reason=case when p_blocked then btrim(p_reason) end where id=p_id;
 end if;
 insert into private.service_radar_audit_logs(admin_user_id,request_id,offer_id,action,reason,note)
 values(auth.uid(),v_request,case when p_entity='offer' then p_id end,
   case when p_entity='request' then case when p_blocked then 'REQUEST_BLOCKED' else 'REQUEST_UNBLOCKED' end
     else case when p_blocked then 'OFFER_BLOCKED' else 'OFFER_UNBLOCKED' end end,btrim(coalesce(p_reason,'')),btrim(coalesce(p_note,'')));
end;
$$;
create function public.admin_resolve_service_radar_report(p_report_id uuid,p_status text,p_expected_revision bigint,p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_row private.service_radar_reports%rowtype;
begin
 perform private.require_admin();
 if p_status is null or p_status not in ('RESOLVED','DISMISSED') or p_expected_revision is null or length(coalesce(p_note,''))>500 then
   raise exception 'SERVICE_RADAR_MODERATION_INVALID' using errcode='22023'; end if;
 select * into v_row from private.service_radar_reports where id=p_report_id for update;
 if not found then raise exception 'SERVICE_RADAR_REPORT_INVALID' using errcode='22023'; end if;
 if v_row.revision<>p_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
 if v_row.status<>'OPEN' then return; end if;
 update private.service_radar_reports set status=p_status,resolved_at=clock_timestamp(),resolved_by=auth.uid(),revision=revision+1,
   resolution_note=btrim(coalesce(p_note,'')) where id=p_report_id;
 insert into private.service_radar_audit_logs(admin_user_id,request_id,offer_id,report_id,action,note)
 values(auth.uid(),v_row.request_id,v_row.offer_id,p_report_id,case when p_status='RESOLVED' then 'REPORT_RESOLVED' else 'REPORT_DISMISSED' end,btrim(coalesce(p_note,'')));
end;
$$;
create function public.admin_read_service_radar(p_section text,p_request_id uuid default null,p_offer_id uuid default null,p_status text default null,p_offset integer default 0,p_limit integer default 24) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.require_admin(); perform private.service_radar_page(p_offset,p_limit);
 if p_section is null or p_section not in ('requests','offers','reports','audit')
   or (p_section='requests' and (p_offer_id is not null or (p_status is not null and p_status not in ('OPEN','CLOSED','CANCELLED','EXPIRED'))))
   or (p_section='offers' and p_status is not null and p_status not in ('PENDING','ACCEPTED','REJECTED','WITHDRAWN'))
   or (p_section='reports' and p_status is not null and p_status not in ('OPEN','RESOLVED','DISMISSED'))
   or (p_section='audit' and p_status is not null) then raise exception 'SERVICE_RADAR_FILTER_INVALID' using errcode='22023'; end if;
 if p_section='requests' then
   with scoped as materialized(select r.*,case when r.status='OPEN' and r.expires_at<=statement_timestamp() then 'EXPIRED' else r.status end as effective_status
     from public.service_requests r where (p_request_id is null or r.id=p_request_id)),
   filtered as materialized(select * from scoped where p_status is null or effective_status=p_status),
   page as(select * from filtered order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from filtered),'offset',p_offset,'limit',p_limit) into v_result;
 elsif p_section='offers' then
   with scoped as materialized(select * from public.service_request_offers where (p_request_id is null or request_id=p_request_id)
     and (p_offer_id is null or id=p_offer_id) and (p_status is null or status=p_status)),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 elsif p_section='reports' then
   with scoped as materialized(select * from private.service_radar_reports where (p_request_id is null or request_id=p_request_id)
     and (p_offer_id is null or offer_id=p_offer_id) and (p_status is null or status=p_status)),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 else
   with scoped as materialized(select * from private.service_radar_audit_logs where (p_request_id is null or request_id=p_request_id)
     and (p_offer_id is null or offer_id=p_offer_id)),
   page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
   select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
     'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 end if;
 return v_result;
end;
$$;
revoke all on function public.report_service_radar(text,uuid,text,text),public.admin_set_service_radar_block(text,uuid,boolean,bigint,text,text),
 public.admin_resolve_service_radar_report(uuid,text,bigint,text),public.admin_read_service_radar(text,uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.report_service_radar(text,uuid,text,text),public.admin_set_service_radar_block(text,uuid,boolean,bigint,text,text),
 public.admin_resolve_service_radar_report(uuid,text,bigint,text),public.admin_read_service_radar(text,uuid,uuid,text,integer,integer) to authenticated;
-- No publicación Postgres Changes, trigger Broadcast ni policy nueva de realtime.messages.
commit;

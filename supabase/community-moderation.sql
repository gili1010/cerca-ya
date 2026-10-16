-- Ejecutar MANUALMENTE como tercer delta, después de personal-listings-access.sql.
-- Reportes/auditoría propios: no altera constraints ni RPC Admin comerciales remotos.
begin;

create table private.personal_listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.personal_listings(id) on delete restrict,
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('Información incorrecta','Artículo prohibido o inapropiado','Posible estafa','Contenido ofensivo','Otro')),
  details text not null default '' check (length(details)<=1000),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED','DISMISSED')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text not null default '' check (length(resolution_note)<=500),
  constraint personal_listing_report_resolution check (
    (status='OPEN' and resolved_at is null and resolved_by is null)
    or (status<>'OPEN' and resolved_at is not null and resolved_by is not null)
  )
);
create unique index personal_listing_reports_one_open_idx
  on private.personal_listing_reports(reporter_user_id,listing_id) where status='OPEN';
create index personal_listing_reports_admin_idx on private.personal_listing_reports(status,created_at desc,id desc);
create index personal_listing_reports_reporter_idx on private.personal_listing_reports(reporter_user_id,created_at desc);

create table private.personal_listing_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  listing_id uuid not null references public.personal_listings(id) on delete restrict,
  report_id uuid references private.personal_listing_reports(id) on delete restrict,
  action text not null check (action in ('LISTING_BLOCKED','LISTING_UNBLOCKED','REPORT_RESOLVED','REPORT_DISMISSED')),
  reason text not null default '' check (length(reason)<=500),
  note text not null default '' check (length(note)<=500),
  created_at timestamptz not null default clock_timestamp()
);
create index personal_listing_audit_date_idx on private.personal_listing_audit_logs(created_at desc,id desc);
create index personal_listing_audit_listing_idx on private.personal_listing_audit_logs(listing_id,created_at desc,id desc);
alter table private.personal_listing_reports enable row level security;
alter table private.personal_listing_audit_logs enable row level security;
revoke all on private.personal_listing_reports,private.personal_listing_audit_logs from public,anon,authenticated;

create function public.report_personal_listing(p_listing_id uuid,p_reason text,p_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_details text := btrim(coalesce(p_details,''));
begin
  perform private.require_active_marketplace_user();
  if p_reason is null or p_reason not in ('Información incorrecta','Artículo prohibido o inapropiado','Posible estafa','Contenido ofensivo','Otro')
    or length(v_details)>1000 then raise exception 'PERSONAL_LISTING_REPORT_INVALID' using errcode='22023'; end if;
  -- Serializa reportes del mismo usuario; también evita carreras con suspensión.
  perform pg_advisory_xact_lock(hashtextextended('personal-listing-reports:' || auth.uid()::text,0));
  if not private.personal_listing_is_public(p_listing_id) then
    raise exception 'PERSONAL_LISTING_UNAVAILABLE' using errcode='22023';
  end if;
  if exists(select 1 from public.personal_listings where id=p_listing_id and owner_id=auth.uid()) then
    raise exception 'PERSONAL_LISTING_REPORT_INVALID' using errcode='22023';
  end if;
  select id into v_id from private.personal_listing_reports
    where listing_id=p_listing_id and reporter_user_id=auth.uid() and status='OPEN';
  if found then return v_id; end if;
  -- Límite propio del módulo; no modifica el rate limit de reportes comerciales.
  if (select count(*) from private.personal_listing_reports where reporter_user_id=auth.uid()
    and created_at>clock_timestamp()-interval '24 hours')>=10 then
    raise exception 'PERSONAL_LISTING_REPORT_LIMIT' using errcode='22023';
  end if;
  insert into private.personal_listing_reports(listing_id,reporter_user_id,reason,details)
    values(p_listing_id,auth.uid(),p_reason,v_details) returning id into v_id;
  return v_id;
end;
$$;

create function public.admin_set_personal_listing_block(p_listing_id uuid,p_blocked boolean,
  p_reason text default '',p_note text default '') returns void
language plpgsql security definer set search_path='' as $$
declare v_listing public.personal_listings%rowtype; v_reason text := btrim(coalesce(p_reason,''));
  v_note text := btrim(coalesce(p_note,''));
begin
  perform private.require_admin();
  if p_blocked is null or length(v_reason)>500 or length(v_note)>500 or (p_blocked and v_reason='') then
    raise exception 'PERSONAL_LISTING_MODERATION_INVALID' using errcode='22023';
  end if;
  select * into v_listing from public.personal_listings where id=p_listing_id for update;
  if not found then raise exception 'PERSONAL_LISTING_UNAVAILABLE' using errcode='22023'; end if;
  if (v_listing.admin_blocked_at is not null)=p_blocked then return; end if;
  update public.personal_listings set admin_blocked_at=case when p_blocked then clock_timestamp() end,
    admin_blocked_by=case when p_blocked then auth.uid() end,
    admin_block_reason=case when p_blocked then v_reason end where id=p_listing_id;
  -- Conserva el estado del vendedor, vencimiento y fotos; desbloquear nunca cambia
  -- SOLD/WITHDRAWN/PAUSED a PUBLISHED ni elude la suspensión de la cuenta.
  insert into private.personal_listing_audit_logs(admin_user_id,listing_id,action,reason,note)
    values(auth.uid(),p_listing_id,case when p_blocked then 'LISTING_BLOCKED' else 'LISTING_UNBLOCKED' end,v_reason,v_note);
end;
$$;

create function public.admin_resolve_personal_listing_report(p_report_id uuid,p_status text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_report private.personal_listing_reports%rowtype; v_note text := btrim(coalesce(p_note,''));
begin
  perform private.require_admin();
  if p_status is null or p_status not in ('RESOLVED','DISMISSED') or length(v_note)>500 then
    raise exception 'PERSONAL_LISTING_MODERATION_INVALID' using errcode='22023';
  end if;
  select * into v_report from private.personal_listing_reports where id=p_report_id for update;
  if not found then raise exception 'PERSONAL_LISTING_REPORT_INVALID' using errcode='22023'; end if;
  if v_report.status<>'OPEN' then return; end if;
  update private.personal_listing_reports set status=p_status,resolved_at=clock_timestamp(),resolved_by=auth.uid(),resolution_note=v_note
    where id=p_report_id;
  insert into private.personal_listing_audit_logs(admin_user_id,listing_id,report_id,action,note)
    values(auth.uid(),v_report.listing_id,p_report_id,case when p_status='RESOLVED' then 'REPORT_RESOLVED' else 'REPORT_DISMISSED' end,v_note);
end;
$$;

-- Backend Admin paginado, sin interfaz nueva y sin exponer GPS reservado.
create function public.admin_read_personal_listings(p_section text,p_listing_id uuid default null,
  p_status text default null,p_offset integer default 0,p_limit integer default 24) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.require_admin();
  if p_section is null or p_section not in ('listings','reports','audit')
    or p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50
    or (p_section='listings' and p_status is not null and p_status not in ('DRAFT','PUBLISHED','PAUSED','SOLD','WITHDRAWN'))
    or (p_section='reports' and p_status is not null and p_status not in ('OPEN','RESOLVED','DISMISSED'))
    or (p_section='audit' and p_status is not null) then
    raise exception 'PERSONAL_LISTING_FILTER_INVALID' using errcode='22023';
  end if;
  if p_section='listings' then
    with scoped as materialized (
      select id,created_at from public.personal_listings where (p_listing_id is null or id=p_listing_id)
        and (p_status is null or status=p_status)
    ), page as (select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
    select jsonb_build_object('items',coalesce((select jsonb_agg(private.personal_listing_document(id,true) order by created_at desc,id desc) from page),'[]'::jsonb),
      'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  elsif p_section='reports' then
    with scoped as materialized (
      select r.* from private.personal_listing_reports r where (p_listing_id is null or r.listing_id=p_listing_id)
        and (p_status is null or r.status=p_status)
    ), page as (select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
    select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
      'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  else
    with scoped as materialized (
      select a.* from private.personal_listing_audit_logs a where p_listing_id is null or a.listing_id=p_listing_id
    ), page as (select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
    select jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb),
      'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
  end if;
  return v_result;
end;
$$;

revoke all on function public.report_personal_listing(uuid,text,text),public.admin_set_personal_listing_block(uuid,boolean,text,text),
  public.admin_resolve_personal_listing_report(uuid,text,text),public.admin_read_personal_listings(text,uuid,text,integer,integer)
  from public,anon,authenticated;
grant execute on function public.report_personal_listing(uuid,text,text),public.admin_set_personal_listing_block(uuid,boolean,text,text),
  public.admin_resolve_personal_listing_report(uuid,text,text),public.admin_read_personal_listings(text,uuid,text,integer,integer) to authenticated;

notify pgrst,'reload schema';
commit;

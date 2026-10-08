-- Delta posterior a admin-phase-1.sql y reservation-items.sql. Ejecutar como postgres.
begin;
create table if not exists private.user_suspensions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  suspended_at timestamptz not null default clock_timestamp()
);
create table if not exists private.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete restrict,
  entity_type text not null check(entity_type in ('business','product')),
  entity_id uuid not null,
  reason text not null check(reason in ('Información incorrecta','Producto prohibido o inapropiado','Posible estafa','Comercio inexistente','Contenido ofensivo','Otro')),
  details text not null default '' check(length(details)<=1000),
  status text not null default 'OPEN' check(status in ('OPEN','RESOLVED','DISMISSED')),
  created_at timestamptz not null default clock_timestamp(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete restrict,
  resolution_note text not null default '' check(length(resolution_note)<=500),
  constraint reports_resolution_consistent check (
    (status='OPEN' and resolved_at is null and resolved_by is null)
    or (status<>'OPEN' and resolved_at is not null and resolved_by is not null)
  )
);
create unique index if not exists reports_one_open_per_resource on private.reports(reporter_user_id,entity_type,entity_id) where status='OPEN';
create index if not exists reports_recent_idx on private.reports(status,created_at desc,id desc);
create index if not exists reports_reporter_idx on private.reports(reporter_user_id,created_at desc);
alter table private.user_suspensions enable row level security;
alter table private.reports enable row level security;
revoke all on private.user_suspensions,private.reports from public,anon,authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and exists(select 1 from private.admin_users where user_id=auth.uid())
    and not exists(select 1 from private.user_suspensions where user_id=auth.uid());
$$;
create or replace function private.require_admin() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode='42501'; end if;
  perform 1 from private.admin_users where user_id=auth.uid() for share;
  if not found or exists(select 1 from private.user_suspensions where user_id=auth.uid()) then
    raise exception 'admin_required' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;
revoke all on function private.require_admin() from public,anon,authenticated;

-- No se actualizan usuarios/comercios/productos ni se crean reportes automáticamente.
alter table private.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table private.admin_audit_logs add constraint admin_audit_logs_action_check check(action in (
  'BUSINESS_SUSPENDED','BUSINESS_REACTIVATED','PRODUCT_BLOCKED','PRODUCT_UNBLOCKED',
  'USER_SUSPENDED','USER_REACTIVATED','REPORT_RESOLVED','REPORT_DISMISSED'
));
alter table private.admin_audit_logs drop constraint if exists admin_audit_logs_entity_type_check;
alter table private.admin_audit_logs add constraint admin_audit_logs_entity_type_check check(entity_type in ('business','product','user','report'));

create or replace function public.is_my_account_suspended() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from private.user_suspensions where user_id=auth.uid());
$$;
revoke all on function public.is_my_account_suspended() from public,anon;
grant execute on function public.is_my_account_suspended() to authenticated;

-- Restrictivas: se combinan con AND con las policies de propiedad existentes,
-- incluso si otro bucket tiene una policy permisiva para authenticated.
-- No se agrega/reemplaza ninguna policy SELECT ni se crean buckets.
drop policy if exists cercaya_storage_active_account_insert on storage.objects;
create policy cercaya_storage_active_account_insert on storage.objects
as restrictive for insert to authenticated
with check (not (select public.is_my_account_suspended()));
drop policy if exists cercaya_storage_active_account_update on storage.objects;
create policy cercaya_storage_active_account_update on storage.objects
as restrictive for update to authenticated
using (not (select public.is_my_account_suspended()))
with check (not (select public.is_my_account_suspended()));
drop policy if exists cercaya_storage_active_account_delete on storage.objects;
create policy cercaya_storage_active_account_delete on storage.objects
as restrictive for delete to authenticated
using (not (select public.is_my_account_suspended()));

create or replace function private.require_active_marketplace_user() returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'account_auth_required' using errcode='42501'; end if;
  -- Serializa las escrituras con una suspensión concurrente, sin alterar Auth.
  perform 1 from auth.users where id=auth.uid() for share;
  if not found then raise exception 'account_auth_required' using errcode='42501'; end if;
  if exists(select 1 from private.user_suspensions where user_id=auth.uid()) then
    raise exception 'account_suspended' using errcode='42501';
  end if;
end;
$$;
revoke all on function private.require_active_marketplace_user() from public,anon,authenticated;

create or replace function private.guard_suspended_marketplace_user() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_order_owner uuid;
begin
  -- Procesos sin sesión mantienen sus permisos actuales. Las escrituras de usuarios
  -- pasan por aquí incluso desde RPC SECURITY DEFINER; no depende del rol efectivo.
  if auth.uid() is not null then
    if tg_table_name='reservations' and tg_op='INSERT' then
      select owner_id into v_order_owner from public.businesses where id=new.business_id;
      -- El mismo bloqueo que usa suspender: si el pedido se crea primero, la
      -- suspensión espera y lo detecta; si se suspende primero, el pedido falla.
      -- Impide además que otro comprador cree pedidos nuevos a un dueño suspendido.
      perform 1 from auth.users where id in (new.buyer_id,v_order_owner) order by id for share;
      perform private.require_active_marketplace_user();
      if exists(select 1 from private.user_suspensions where user_id in (new.buyer_id,v_order_owner)) then
        -- Usa el mensaje comercial existente, sin revelar el estado privado del dueño.
        raise exception 'reservation_product_unavailable' using errcode='42501';
      end if;
    else
      perform private.require_active_marketplace_user();
    end if;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.guard_suspended_marketplace_user() from public,anon,authenticated;
do $$
declare v_table text;
begin
  foreach v_table in array array['businesses','business_categories','products','product_images','requests','offers','reservations','reservation_items','favorites','messages'] loop
    if to_regclass('public.'||v_table) is not null then
      execute format('drop trigger if exists account_suspension_guard on public.%I',v_table);
      execute format('create trigger account_suspension_guard before insert or update or delete on public.%I for each row execute function private.guard_suspended_marketplace_user()',v_table);
    end if;
  end loop;
end;
$$;

create or replace function public.admin_set_user_suspension(p_user_id uuid,p_suspended boolean,p_reason text default '',p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_was_suspended boolean; v_reason text:=btrim(coalesce(p_reason,'')); v_note text:=btrim(coalesce(p_note,''));
begin
  perform private.require_admin();
  if p_user_id is null or p_suspended is null or length(v_note)>500 or length(v_reason)>100
    or (p_suspended and v_reason not in ('Abuso de la plataforma','Spam','Fraude','Contenido prohibido','Incumplimiento','Otro')) then
    raise exception 'admin_invalid_input' using errcode='22023';
  end if;
  perform 1 from auth.users where id=p_user_id for update;
  if not found then raise exception 'admin_resource_missing' using errcode='P0002'; end if;
  -- Evita quitarse acceso o suspender administradores desde este panel básico.
  if p_suspended and exists(select 1 from private.admin_users where user_id=p_user_id) then
    raise exception 'admin_user_protected' using errcode='42501';
  end if;
  select exists(select 1 from private.user_suspensions where user_id=p_user_id) into v_was_suspended;
  if v_was_suspended=p_suspended then return; end if;
  -- El bloqueo de auth.users anterior serializa esto con la creación de pedidos.
  -- clock_timestamp evita considerar vencido/activo usando una hora anterior a la espera.
  if p_suspended and exists (
    select 1 from public.reservations r
    where (r.buyer_id=p_user_id or exists (
      select 1 from public.businesses b where b.id=r.business_id and b.owner_id=p_user_id
    )) and (
      r.status in ('CONFIRMED','READY')
      or (r.status='PENDING' and r.expires_at>clock_timestamp())
    )
  ) then
    raise exception 'USER_HAS_ACTIVE_ORDERS' using errcode='22023';
  end if;
  if p_suspended then insert into private.user_suspensions(user_id) values(p_user_id);
  else delete from private.user_suspensions where user_id=p_user_id; end if;
  insert into private.admin_audit_logs(admin_user_id,action,entity_type,entity_id,reason,metadata)
  values(auth.uid(),case when p_suspended then 'USER_SUSPENDED' else 'USER_REACTIVATED' end,'user',p_user_id,v_reason,jsonb_build_object('note',v_note));
end;
$$;
revoke all on function public.admin_set_user_suspension(uuid,boolean,text,text) from public,anon;
grant execute on function public.admin_set_user_suspension(uuid,boolean,text,text) to authenticated;

create or replace function public.create_my_report(p_entity text,p_entity_id uuid,p_reason text,p_details text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_details text:=btrim(coalesce(p_details,''));
begin
  perform private.require_active_marketplace_user();
  if p_entity is null or p_entity not in ('business','product') or p_entity_id is null
    or p_reason is null or p_reason not in ('Información incorrecta','Producto prohibido o inapropiado','Posible estafa','Comercio inexistente','Contenido ofensivo','Otro')
    or length(v_details)>1000 then raise exception 'report_invalid_input' using errcode='22023'; end if;
  if p_entity='business' then
    perform 1 from public.businesses where id=p_entity_id and active;
  else
    perform 1 from public.products p join public.businesses b on b.id=p.business_id where p.id=p_entity_id and p.active and b.active;
  end if;
  if not found then raise exception 'report_resource_unavailable' using errcode='P0002'; end if;
  -- Límite adicional de 20 reportes/24h por usuario, serializado entre pestañas.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,2402));
  if exists(select 1 from private.reports where reporter_user_id=auth.uid() and entity_type=p_entity and entity_id=p_entity_id and status='OPEN') then
    raise exception 'report_already_open' using errcode='23505';
  end if;
  if (select count(*) from private.reports where reporter_user_id=auth.uid() and created_at>=clock_timestamp()-interval '24 hours')>=20 then
    raise exception 'report_rate_limit' using errcode='22023';
  end if;
  insert into private.reports(reporter_user_id,entity_type,entity_id,reason,details)
  values(auth.uid(),p_entity,p_entity_id,p_reason,btrim(v_details)) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_my_report(text,uuid,text,text) from public,anon;
grant execute on function public.create_my_report(text,uuid,text,text) to authenticated;

create or replace function public.admin_resolve_report(p_report_id uuid,p_status text,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_status text; v_note text:=btrim(coalesce(p_note,''));
begin
  perform private.require_admin();
  if p_status is null or p_status not in ('RESOLVED','DISMISSED') or length(v_note)>500 then
    raise exception 'admin_invalid_input' using errcode='22023';
  end if;
  select status into v_status from private.reports where id=p_report_id for update;
  if not found then raise exception 'admin_resource_missing' using errcode='P0002'; end if;
  if v_status<>'OPEN' then raise exception 'report_already_closed' using errcode='22023'; end if;
  update private.reports set status=p_status,resolved_at=clock_timestamp(),resolved_by=auth.uid(),resolution_note=v_note where id=p_report_id;
  insert into private.admin_audit_logs(admin_user_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),case when p_status='RESOLVED' then 'REPORT_RESOLVED' else 'REPORT_DISMISSED' end,'report',p_report_id,jsonb_build_object('note',v_note));
end;
$$;
revoke all on function public.admin_resolve_report(uuid,text,text) from public,anon;
grant execute on function public.admin_resolve_report(uuid,text,text) to authenticated;

-- Contrato nuevo, sin duplicar/reemplazar la lectura de comercios/productos de Fase 1.
create or replace function public.admin_read_phase2(p_section text,p_filters jsonb default '{}'::jsonb,p_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  v_result jsonb;
  v_q text:=lower(left(btrim(coalesce(p_filters->>'q','')),160));
  v_buyer text:=lower(left(btrim(coalesce(p_filters->>'buyer','')),160));
  v_business text:=lower(left(btrim(coalesce(p_filters->>'business','')),160));
  v_state text:=coalesce(p_filters->>'state','all');
  v_mode text:=coalesce(p_filters->>'mode','all');
  v_limit integer;
  v_offset integer;
  v_from date;
  v_to date;
begin
  perform private.require_admin();
  v_limit:=least(greatest(coalesce((p_filters->>'limit')::integer,25),1),50);
  v_offset:=least(greatest(coalesce((p_filters->>'offset')::integer,0),0),1000000);
  v_from:=nullif(p_filters->>'from','')::date;
  v_to:=nullif(p_filters->>'to','')::date;
  if p_section='dashboard' then
    v_result:=public.admin_read('dashboard') || jsonb_build_object(
      'active_users',(select count(*) from auth.users u where not exists(select 1 from private.user_suspensions s where s.user_id=u.id)),
      'suspended_users',(select count(*) from private.user_suspensions),
      'open_reports',(select count(*) from private.reports where status='OPEN')
    );
  elsif p_section in ('users','user') then
    with filtered as (
      select u.id,pr.full_name as name,u.email,u.created_at,s.suspended_at,
        case when p_section='user' then pr.phone else null end as phone,
        exists(select 1 from private.admin_users a where a.user_id=u.id) as is_admin
      from auth.users u left join public.profiles pr on pr.id=u.id left join private.user_suspensions s on s.user_id=u.id
      where (p_section<>'user' or u.id=p_id)
        and (v_q='' or strpos(lower(coalesce(pr.full_name,'')),v_q)>0 or strpos(lower(coalesce(u.email,'')),v_q)>0 or strpos(coalesce(pr.phone,''),v_q)>0)
        and (v_state='all' or (v_state='active' and s.user_id is null) or (v_state='suspended' and s.user_id is not null))
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset),
    enriched as (
      select page.*,(select count(*) from public.reservations r where r.buyer_id=page.id) as order_count,
      coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.created_at desc) from public.businesses b where b.owner_id=page.id),'[]'::jsonb) as businesses,
      case when p_section='user' then coalesce((select jsonb_agg(to_jsonb(recent) order by created_at desc,id desc) from (
        select r.id,r.created_at,case when r.status='PENDING' and r.expires_at<=now() then 'EXPIRED' else r.status::text end as status,r.total,b.name as business_name from public.reservations r join public.businesses b on b.id=r.business_id where r.buyer_id=page.id order by r.created_at desc,r.id desc limit 10
      ) recent),'[]'::jsonb) else '[]'::jsonb end as recent_orders
      from page
    ) select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(enriched) order by created_at desc,id desc) from enriched),'[]'::jsonb)) into v_result;
  elsif p_section in ('orders','order') then
    with filtered as (
      select r.id,r.created_at,case when r.status='PENDING' and r.expires_at<=now() then 'EXPIRED' else r.status::text end as status,r.total,r.delivery_type,r.buyer_id,r.business_id,
        pr.full_name as buyer_name,b.name as business_name,
        r.confirmed_at,r.ready_at,r.completed_at,r.cancelled_at,r.expires_at
      from public.reservations r join public.businesses b on b.id=r.business_id left join public.profiles pr on pr.id=r.buyer_id
      where (p_section<>'order' or r.id=p_id)
        and (v_q='' or strpos(lower(r.id::text),v_q)>0 or strpos(replace(lower(r.id::text),'-',''),replace(v_q,'-',''))>0)
        and (v_buyer='' or strpos(lower(coalesce(pr.full_name,'')),v_buyer)>0 or strpos(lower(r.buyer_id::text),v_buyer)>0)
        and (v_business='' or strpos(lower(b.name),v_business)>0)
        and (v_state='all' or (case when r.status='PENDING' and r.expires_at<=now() then 'EXPIRED' else r.status::text end)=v_state) and (v_mode='all' or r.delivery_type::text=v_mode)
        and (v_from is null or r.created_at >= (v_from::timestamp at time zone 'America/Argentina/Cordoba'))
        and (v_to is null or r.created_at < ((v_to+1)::timestamp at time zone 'America/Argentina/Cordoba'))
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset),
    enriched as (
      select page.*,(select count(*) from public.reservation_items i where i.reservation_id=page.id) as item_count,
        case when p_section='order' then (select jsonb_build_object(
          'customer_name',x.customer_name,'customer_phone',x.customer_phone,'delivery_address',x.delivery_address,
          'delivery_city',x.delivery_city,'delivery_reference',x.delivery_reference,'payment_method',x.payment_method,
          'pickup_address',x.pickup_address,'pickup_city',x.pickup_city
        ) from private.reservation_checkout x where x.reservation_id=page.id) else null end as checkout,
        case when p_section='order' then coalesce((select jsonb_agg(jsonb_build_object(
          'name',i.product_name_snapshot,'quantity',i.quantity,'unit_price',i.unit_price,'subtotal',i.quantity::numeric*i.unit_price,
          'image_url',(select img.url from public.product_images img where img.product_id=i.product_id order by img.position limit 1)
        ) order by i.created_at,i.id) from public.reservation_items i where i.reservation_id=page.id),'[]'::jsonb) else '[]'::jsonb end as items
      from page
    ) select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(enriched) order by created_at desc,id desc) from enriched),'[]'::jsonb)) into v_result;
  elsif p_section='product' then
    select jsonb_build_object('total',count(*),'rows',coalesce(jsonb_agg(to_jsonb(detail)),'[]'::jsonb)) into v_result from (
      select p.id,p.name,p.business_id,b.name as business_name,b.active as business_active,
        c.name as category_name,p.price,p.inventory_mode,p.active,p.admin_blocked_at,p.created_at,
        (select i.url from public.product_images i where i.product_id=p.id order by i.position limit 1) as image_url
      from public.products p join public.businesses b on b.id=p.business_id join public.categories c on c.id=p.category_id where p.id=p_id
    ) detail;
  elsif p_section in ('reports','report') then
    with filtered as (
      select rp.id,rp.reporter_user_id,rp.entity_type,rp.entity_id,rp.reason,rp.status,rp.created_at,
        pr.full_name as reporter_name,coalesce(b.name,p.name) as resource_name,
        case when p_section='report' then rp.details else null end as details,
        case when p_section='report' then rp.resolution_note else null end as resolution_note,
        rp.resolved_at,rp.resolved_by,
        coalesce(b.slug,pb.slug) as business_slug,
        coalesce(b.id,p.business_id) as business_id
      from private.reports rp left join public.profiles pr on pr.id=rp.reporter_user_id
      left join public.businesses b on rp.entity_type='business' and b.id=rp.entity_id
      left join public.products p on rp.entity_type='product' and p.id=rp.entity_id
      left join public.businesses pb on pb.id=p.business_id
      where (p_section<>'report' or rp.id=p_id) and (v_state='all' or rp.status=v_state)
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset)
    select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb)) into v_result;
  elsif p_section='audit' then
    with page as (
      select a.id,a.admin_user_id,pr.full_name as admin_name,a.action,a.entity_type,a.entity_id,a.reason,a.created_at,a.metadata->>'note' as note,
        coalesce(b.name,p.name,up.full_name,rp.reason) as resource_name
      from private.admin_audit_logs a left join public.profiles pr on pr.id=a.admin_user_id
      left join public.businesses b on a.entity_type='business' and b.id=a.entity_id
      left join public.products p on a.entity_type='product' and p.id=a.entity_id
      left join public.profiles up on a.entity_type='user' and up.id=a.entity_id
      left join private.reports rp on a.entity_type='report' and rp.id=a.entity_id
      order by a.created_at desc,a.id desc limit v_limit offset v_offset
    ) select jsonb_build_object('total',(select count(*) from private.admin_audit_logs),'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb)) into v_result;
  else raise exception 'admin_invalid_section' using errcode='22023'; end if;
  return v_result;
end;
$$;
revoke all on function public.admin_read_phase2(text,jsonb,uuid) from public,anon;
grant execute on function public.admin_read_phase2(text,jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

-- Fase 1. Ejecutar manualmente como postgres en el SQL Editor, después de los
-- deltas actuales de inventario/pedidos. No cambia el estado de filas existentes.
begin;

create schema if not exists private;
create table if not exists private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists private.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('BUSINESS_SUSPENDED','BUSINESS_REACTIVATED','PRODUCT_BLOCKED','PRODUCT_UNBLOCKED')),
  entity_type text not null check (entity_type in ('business','product')),
  entity_id uuid not null,
  reason text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists admin_audit_logs_recent_idx on private.admin_audit_logs(created_at desc, id desc);
create index if not exists admin_audit_logs_entity_idx on private.admin_audit_logs(entity_type, entity_id, created_at desc);
alter table private.admin_users enable row level security;
alter table private.admin_audit_logs enable row level security;
revoke all on private.admin_users, private.admin_audit_logs from public, anon, authenticated;

alter table public.businesses add column if not exists admin_suspended_at timestamptz;
alter table public.products add column if not exists admin_blocked_at timestamptz;
-- Las concesiones actuales son por columna. Reafirmar que estas marcas no son editables.
revoke insert (admin_suspended_at), update (admin_suspended_at) on public.businesses from anon, authenticated;
revoke insert (admin_blocked_at), update (admin_blocked_at) on public.products from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from private.admin_users where user_id = auth.uid()
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function private.require_admin() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'admin_auth_required' using errcode = '42501'; end if;
  -- Mantiene la autorización durante la transacción, incluso ante una revocación.
  perform 1 from private.admin_users where user_id = auth.uid() for share;
  if not found then raise exception 'admin_required' using errcode = '42501'; end if;
end;
$$;
revoke all on function private.require_admin() from public, anon, authenticated;

-- SECURITY INVOKER: current_user distingue el RPC definer de los updates del dueño.
-- El marcador por sí solo NO autoriza; también se verifica el propietario del RPC y ADMIN.
create or replace function private.guard_admin_resource_status() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_field text := case when tg_table_name = 'businesses' then 'admin_suspended_at' else 'admin_blocked_at' end;
  v_entity text := case when tg_table_name = 'businesses' then 'business' else 'product' end;
  v_before text;
  v_after text := to_jsonb(new)->>v_field;
  v_trusted boolean;
begin
  if tg_op = 'UPDATE' then v_before := to_jsonb(old)->>v_field; end if;
  if v_before is distinct from v_after then
    select current_user = pg_get_userbyid(p.proowner)
      and current_setting('cercaya.admin_status_change', true) = v_entity || ':' || new.id::text
      into v_trusted
      from pg_catalog.pg_proc p
      where p.oid = 'public.admin_set_resource_status(text,uuid,boolean,text,text)'::regprocedure;
    if not coalesce(v_trusted, false) or not public.is_admin() then
      raise exception 'admin_status_protected' using errcode = '42501';
    end if;
  end if;
  if v_after is not null and new.active then
    raise exception 'admin_resource_blocked' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_admin_resource_status() from public, anon, authenticated;

create or replace function private.guard_admin_audit_log() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'admin_audit_immutable' using errcode = '42501';
end;
$$;
revoke all on function private.guard_admin_audit_log() from public, anon, authenticated;
drop trigger if exists admin_audit_immutable on private.admin_audit_logs;
create trigger admin_audit_immutable before update or delete on private.admin_audit_logs
for each row execute function private.guard_admin_audit_log();

create or replace function public.admin_set_resource_status(
  p_entity text, p_id uuid, p_blocked boolean, p_reason text default '', p_note text default ''
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_active boolean;
  v_marker timestamptz;
  v_previous_active boolean;
  v_action text;
  v_reason text := btrim(coalesce(p_reason,''));
  v_note text := btrim(coalesce(p_note,''));
begin
  perform private.require_admin();
  if p_entity not in ('business','product') or p_entity is null or p_id is null or p_blocked is null then
    raise exception 'admin_invalid_input' using errcode = '22023';
  end if;
  if length(v_note) > 500 or length(v_reason) > 100 or (p_blocked and v_reason not in (
    'Contenido prohibido','Datos falsos','Incumplimiento','Solicitud del propietario','Otro'
  )) then raise exception 'admin_reason_required' using errcode = '22023'; end if;
  if p_entity = 'business' then
    select active, admin_suspended_at into v_active, v_marker from public.businesses where id = p_id for update;
  else
    select active, admin_blocked_at into v_active, v_marker from public.products where id = p_id for update;
  end if;
  if not found then raise exception 'admin_resource_missing' using errcode = 'P0002'; end if;
  -- Repetir la misma acción no duplica logs ni altera la restauración anterior.
  if p_blocked = (v_marker is not null) then return; end if;
  if not p_blocked then
    select (metadata->>'previous_active')::boolean into v_previous_active
      from private.admin_audit_logs
      where entity_type = p_entity and entity_id = p_id
        and action = case when p_entity = 'business' then 'BUSINESS_SUSPENDED' else 'PRODUCT_BLOCKED' end
      order by created_at desc, id desc limit 1;
    -- Si faltara el registro previo, no publicar automáticamente el recurso.
    v_previous_active := coalesce(v_previous_active, false);
  end if;
  perform set_config('cercaya.admin_status_change', p_entity || ':' || p_id::text, true);
  if p_entity = 'business' then
    update public.businesses set active = case when p_blocked then false else v_previous_active end,
      admin_suspended_at = case when p_blocked then clock_timestamp() else null end where id = p_id;
    v_action := case when p_blocked then 'BUSINESS_SUSPENDED' else 'BUSINESS_REACTIVATED' end;
  else
    update public.products set active = case when p_blocked then false else v_previous_active end,
      admin_blocked_at = case when p_blocked then clock_timestamp() else null end where id = p_id;
    v_action := case when p_blocked then 'PRODUCT_BLOCKED' else 'PRODUCT_UNBLOCKED' end;
  end if;
  perform set_config('cercaya.admin_status_change', '', true);
  insert into private.admin_audit_logs(admin_user_id, action, entity_type, entity_id, reason, metadata)
    values (auth.uid(), v_action, p_entity, p_id, v_reason,
      jsonb_build_object('previous_active', v_active, 'restored_active', case when p_blocked then false else v_previous_active end, 'note', v_note));
end;
$$;
revoke all on function public.admin_set_resource_status(text,uuid,boolean,text,text) from public, anon;
grant execute on function public.admin_set_resource_status(text,uuid,boolean,text,text) to authenticated;

drop trigger if exists businesses_admin_status_guard on public.businesses;
create trigger businesses_admin_status_guard before insert or update on public.businesses
for each row execute function private.guard_admin_resource_status();
drop trigger if exists products_admin_status_guard on public.products;
create trigger products_admin_status_guard before insert or update on public.products
for each row execute function private.guard_admin_resource_status();

-- Lectura explícita y limitada: no entrega coordenadas, email, teléfono, alias
-- de transferencia, datos de pedidos ni perfiles completos.
create or replace function public.admin_read(
  p_section text, p_query text default '', p_business_query text default '',
  p_state text default 'all', p_offset integer default 0, p_limit integer default 25, p_id uuid default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_result jsonb;
  v_query text := lower(left(btrim(coalesce(p_query,'')),160));
  v_business_query text := lower(left(btrim(coalesce(p_business_query,'')),160));
  v_limit integer := least(greatest(coalesce(p_limit,25),1),50);
  v_offset integer := least(greatest(coalesce(p_offset,0),0),1000000);
begin
  perform private.require_admin();
  if p_state is null or p_state not in ('all','active','inactive','blocked') then
    raise exception 'admin_invalid_input' using errcode = '22023';
  end if;
  if p_section = 'dashboard' then
    select jsonb_build_object(
      'users',(select count(*) from public.profiles),
      'businesses',(select count(*) from public.businesses),
      'active_businesses',(select count(*) from public.businesses where active),
      'active_products',(select count(*) from public.products p join public.businesses b on b.id=p.business_id where p.active and b.active),
      'orders',(select count(*) from public.reservations),
      'recent_orders',(select count(*) from public.reservations where created_at >= now()-interval '7 days')
    ) into v_result;
  elsif p_section in ('businesses','business') then
    with filtered as (
      select b.id, b.name, b.slug, b.city, b.active, b.admin_suspended_at, b.created_at,
        case when p_section = 'business' then b.description else null end as description,
        b.pickup_enabled, b.delivery_enabled, pr.full_name as owner_name
      from public.businesses b left join public.profiles pr on pr.id=b.owner_id
      where (p_section <> 'business' or b.id=p_id)
        and (v_query='' or strpos(lower(b.name),v_query)>0)
        and (p_state='all' or (p_state='active' and b.active)
          or (p_state='inactive' and not b.active) or (p_state='blocked' and b.admin_suspended_at is not null))
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset),
    enriched as (
      select page.*,
        (select count(*) from public.products p where p.business_id=page.id) as product_count,
        coalesce((select jsonb_agg(c.name order by c.name) from public.business_categories bc join public.categories c on c.id=bc.category_id where bc.business_id=page.id),'[]'::jsonb) as categories
      from page
    )
    select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(enriched) order by created_at desc,id desc) from enriched),'[]'::jsonb)) into v_result;
  elsif p_section = 'products' then
    with filtered as (
      select p.id,p.name,p.business_id,b.name as business_name,b.active as business_active,
        c.name as category_name,p.price,p.inventory_mode,p.active,p.admin_blocked_at,p.created_at
      from public.products p join public.businesses b on b.id=p.business_id join public.categories c on c.id=p.category_id
      where (v_query='' or strpos(lower(p.name),v_query)>0)
        and (v_business_query='' or strpos(lower(b.name),v_business_query)>0)
        and (p_state='all' or (p_state='active' and p.active) or (p_state='inactive' and not p.active)
          or (p_state='blocked' and p.admin_blocked_at is not null))
    ), page as (select * from filtered order by created_at desc,id desc limit v_limit offset v_offset),
    enriched as (
      select page.*, (select i.url from public.product_images i where i.product_id=page.id order by i.position limit 1) as image_url from page
    )
    select jsonb_build_object('total',(select count(*) from filtered),'rows',coalesce((select jsonb_agg(to_jsonb(enriched) order by created_at desc,id desc) from enriched),'[]'::jsonb)) into v_result;
  elsif p_section = 'audit' then
    with page as (
      select a.id,a.admin_user_id,pr.full_name as admin_name,a.action,a.entity_type,a.entity_id,a.reason,a.created_at,
        a.metadata->>'note' as note,coalesce(b.name,p.name) as resource_name
      from private.admin_audit_logs a left join public.profiles pr on pr.id=a.admin_user_id
      left join public.businesses b on a.entity_type='business' and b.id=a.entity_id
      left join public.products p on a.entity_type='product' and p.id=a.entity_id
      order by a.created_at desc,a.id desc limit v_limit offset v_offset
    ) select jsonb_build_object('total',(select count(*) from private.admin_audit_logs),
      'rows',coalesce((select jsonb_agg(to_jsonb(page) order by created_at desc,id desc) from page),'[]'::jsonb)) into v_result;
  else raise exception 'admin_invalid_section' using errcode = '22023';
  end if;
  return v_result;
end;
$$;
revoke all on function public.admin_read(text,text,text,text,integer,integer,uuid) from public, anon;
grant execute on function public.admin_read(text,text,text,text,integer,integer,uuid) to authenticated;

commit;

-- Primer ADMIN: NO ejecutar sin reemplazar el UUID. Copiarlo desde Authentication > Users.
-- insert into private.admin_users(user_id) values ('UUID-DE-TU-USUARIO'::uuid) on conflict do nothing;
-- Revocar acceso (sólo manualmente): delete from private.admin_users where user_id = 'UUID-DE-TU-USUARIO'::uuid;

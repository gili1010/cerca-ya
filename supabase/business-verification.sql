-- Delta posterior a Admin Fase 2. Reutiliza businesses.verified y la auditoría
-- privada para verified_at/verified_by; no inventa fechas para verificaciones previas.
begin;
alter table private.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table private.admin_audit_logs add constraint admin_audit_logs_action_check check(action in (
  'BUSINESS_SUSPENDED','BUSINESS_REACTIVATED','PRODUCT_BLOCKED','PRODUCT_UNBLOCKED',
  'USER_SUSPENDED','USER_REACTIVATED','REPORT_RESOLVED','REPORT_DISMISSED',
  'BUSINESS_VERIFIED','BUSINESS_UNVERIFIED'
));
revoke insert(verified),update(verified) on public.businesses from public,anon,authenticated;

create or replace function public.admin_set_business_verification(p_business_id uuid,p_verified boolean,
  p_reason text default '',p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare v_verified boolean; v_reason text := btrim(coalesce(p_reason,''));
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  perform private.require_admin();
  if p_business_id is null or p_verified is null or length(v_reason)>100 or length(coalesce(v_note,''))>500
    or (not p_verified and v_reason not in ('Datos inconsistentes','Comercio cerrado','Cambio de responsable',
      'Reportes o incumplimientos','Verificación realizada por error','Otro')) then
    raise exception 'business_verification_invalid' using errcode='22023';
  end if;
  select verified into v_verified from public.businesses where id=p_business_id for update;
  if not found then raise exception 'business_verification_not_found' using errcode='P0002'; end if;
  if v_verified=p_verified then return; end if;
  perform set_config('cercaya.business_verification_change',p_business_id::text,true);
  update public.businesses set verified=p_verified where id=p_business_id;
  perform set_config('cercaya.business_verification_change','',true);
  -- Fecha/admin del servidor, en la misma transacción que el cambio de estado.
  insert into private.admin_audit_logs(admin_user_id,action,entity_type,entity_id,reason,metadata,created_at)
    values(auth.uid(),case when p_verified then 'BUSINESS_VERIFIED' else 'BUSINESS_UNVERIFIED' end,
      'business',p_business_id,case when p_verified then '' else v_reason end,
      jsonb_build_object('previous_verified',v_verified,'verified',p_verified,'note',v_note),clock_timestamp());
end;
$$;
revoke all on function public.admin_set_business_verification(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.admin_set_business_verification(uuid,boolean,text,text) to authenticated;

-- Defensa adicional aunque en el futuro se amplíen permisos o se agreguen RPCs.
create or replace function private.guard_business_verification() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_changed boolean; v_trusted boolean;
begin
  v_changed := case when tg_op='INSERT' then new.verified else new.verified is distinct from old.verified end;
  if v_changed then
    select current_user=pg_get_userbyid(p.proowner)
      and current_setting('cercaya.business_verification_change',true)=new.id::text
      into v_trusted from pg_catalog.pg_proc p
      where p.oid='public.admin_set_business_verification(uuid,boolean,text,text)'::regprocedure;
    if not coalesce(v_trusted,false) or not public.is_admin() then
      raise exception 'business_verification_protected' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_business_verification() from public,anon,authenticated;
drop trigger if exists businesses_verification_guard on public.businesses;
create trigger businesses_verification_guard before insert or update on public.businesses
  for each row execute function private.guard_business_verification();

create or replace function public.admin_read_business_verification(p_business_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.require_admin();
  select jsonb_build_object('verified',b.verified,
    'verified_at',case when b.verified then a.created_at end,
    'verified_by',case when b.verified then a.admin_user_id end,
    'admin_name',case when b.verified then pr.full_name end)
    into v_result from public.businesses b
    left join lateral (select created_at,admin_user_id from private.admin_audit_logs
      where entity_type='business' and entity_id=b.id and action='BUSINESS_VERIFIED'
      order by created_at desc,id desc limit 1) a on b.verified
    left join public.profiles pr on pr.id=a.admin_user_id where b.id=p_business_id;
  if v_result is null then raise exception 'business_verification_not_found' using errcode='P0002'; end if;
  return v_result;
end;
$$;
revoke all on function public.admin_read_business_verification(uuid) from public,anon,authenticated;
grant execute on function public.admin_read_business_verification(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

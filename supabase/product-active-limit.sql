-- Delta: máximo 30 productos activos por comercio. No cambia stock ni RPC existentes.
-- Ejecutar manualmente después de las migraciones comerciales actuales.
begin;
create schema if not exists private;
-- Evita escrituras entre el conteo inicial y la instalación del trigger.
lock table public.products in share row exclusive mode;
create table if not exists private.business_active_product_counts (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  active_count bigint not null default 0 check (active_count >= 0)
);
alter table private.business_active_product_counts enable row level security;
revoke all on table private.business_active_product_counts from public, anon, authenticated;
-- Permite instalar/reaplicar sin modificar productos existentes, incluso si ya superan 30.
insert into private.business_active_product_counts (business_id, active_count)
select b.id, count(p.id) filter (where p.active)
from public.businesses b left join public.products p on p.business_id=b.id
group by b.id
on conflict (business_id) do update set active_count=excluded.active_count;

create or replace function private.enforce_business_active_product_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old_business uuid;
  v_new_business uuid;
begin
  if TG_OP <> 'INSERT' then
    if old.active then v_old_business := old.business_id; end if;
  end if;
  if TG_OP <> 'DELETE' then
    if new.active then v_new_business := new.business_id; end if;
  end if;
  -- Editar un producto que ya está activo no consume otro lugar.
  if v_old_business is not distinct from v_new_business then return null; end if;
  if v_old_business is not null then
    update private.business_active_product_counts
      set active_count=active_count-1
      where business_id=v_old_business;
  end if;
  if v_new_business is not null then
    insert into private.business_active_product_counts (business_id,active_count)
      values (v_new_business,0) on conflict (business_id) do nothing;
    -- UPDATE bloquea la fila y reevalúa el cupo al desbloquearse.
    -- Dos solicitudes concurrentes nunca pueden consumir el mismo lugar.
    update private.business_active_product_counts
      set active_count=active_count+1
      where business_id=v_new_business and active_count < 30;
    if not found then
      raise exception 'product_active_limit_reached' using errcode='P0001';
    end if;
  end if;
  return null;
end;
$$;
revoke all on function private.enforce_business_active_product_limit() from public,anon,authenticated;
drop trigger if exists cercaya_active_product_limit on public.products;
create trigger cercaya_active_product_limit
after insert or update of active,business_id or delete on public.products
for each row execute function private.enforce_business_active_product_limit();
commit;

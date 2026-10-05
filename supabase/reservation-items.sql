-- Delta: ejecutar manualmente DESPUÉS de reservation-checkout.sql.
-- Conserva los UUID, el checkout privado, los estados, las RLS de reservations y
-- las señales mínimas de Realtime. No volver a ejecutar los SQL históricos.
-- Aplicar sin escrituras concurrentes: NOWAIT aborta sin cambios si hay actividad;
-- en ese caso volver a ejecutar el archivo completo cuando termine la operación.
begin;

-- Backfill y sustitución de RPC forman una sola transacción. No esperar bloqueos
-- en orden inverso a una operación de stock que ya estuviera en curso.
lock table public.businesses, public.products, public.reservations
  in access exclusive mode nowait;

alter table public.reservations add column if not exists items_subtotal numeric(22,2);
update public.reservations
  set items_subtotal = quantity::numeric * unit_price
  where items_subtotal is null;
alter table public.reservations alter column items_subtotal set not null;

-- DROP EXPRESSION conserva la columna, sus valores históricos y dependencias.
-- Las RPC calculan el total; CHECK + constraint triggers lo vinculan a los items.
alter table public.reservations alter column total drop expression if exists;
alter table public.reservations alter column total set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.reservations'::regclass and conname='reservations_id_business_key') then
    alter table public.reservations add constraint reservations_id_business_key unique (id,business_id);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.reservations'::regclass and conname='reservations_items_total_check') then
    alter table public.reservations add constraint reservations_items_total_check
      check (items_subtotal >= 0 and total = items_subtotal + delivery_price);
  end if;
end $$;
revoke insert(items_subtotal,total), update(items_subtotal,total)
  on public.reservations from public,anon,authenticated;

create table if not exists public.reservation_items (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null,
  business_id uuid not null,
  product_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price between 0 and 9999999999.99),
  product_name_snapshot text not null check (length(btrim(product_name_snapshot)) between 1 and 160),
  inventory_mode_snapshot text not null check (inventory_mode_snapshot in ('STOCKED','ON_DEMAND')),
  -- Sólo interno: distingue unidades efectivamente descontadas de snapshots de
  -- modo. No se devuelve por read_my_reservations ni se publica por Realtime.
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reservation_items_reservation_product_key unique(reservation_id,product_id),
  constraint reservation_items_reservation_business_fkey foreign key(reservation_id,business_id)
    references public.reservations(id,business_id) on delete cascade,
  constraint reservation_items_product_business_fkey foreign key(product_id,business_id)
    references public.products(id,business_id) on delete restrict,
  constraint reservation_items_stock_deducted_check
    check (not stock_deducted or inventory_mode_snapshot='STOCKED')
);
create index if not exists reservation_items_product_id_idx on public.reservation_items(product_id);

-- Cada fila histórica conserva cantidad, precio, modo y fecha de su reserva.
-- El nombre anterior nunca se almacenó: capturamos el nombre actual del catálogo.
-- NO se descuenta/devuelve stock durante esta migración.
insert into public.reservation_items(reservation_id,business_id,product_id,quantity,unit_price,
  product_name_snapshot,inventory_mode_snapshot,stock_deducted,created_at)
select r.id,r.business_id,r.product_id,r.quantity,r.unit_price,p.name,r.inventory_mode,
  r.inventory_mode='STOCKED' and r.status in ('CONFIRMED','READY','COMPLETED'),r.created_at
from public.reservations r join public.products p on p.id=r.product_id and p.business_id=r.business_id
where not exists (select 1 from public.reservation_items i where i.reservation_id=r.id);

-- Sin acceso directo: el comprador y el comercio leen únicamente la proyección
-- autenticada de la RPC. La tabla hija no es parte de supabase_realtime.
alter table public.reservation_items enable row level security;
revoke all on public.reservation_items from public,anon,authenticated;

-- Defensa de integridad independiente de la RPC: al cerrar la transacción el
-- subtotal debe ser SUM(items), y los campos legacy deben representar el primer
-- producto ordenado por UUID. No admite cabeceras vacías o importes arbitrarios.
create or replace function private.check_reservation_items_integrity()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  v_ids uuid[]; v_id uuid; v_row public.reservations%rowtype;
  v_first public.reservation_items%rowtype; v_sum numeric; v_count bigint;
begin
  if tg_table_name='reservations' then
    v_ids := array[case when tg_op='DELETE' then old.id else new.id end];
  elsif tg_op='INSERT' then v_ids := array[new.reservation_id];
  elsif tg_op='DELETE' then v_ids := array[old.reservation_id];
  else v_ids := array[old.reservation_id,new.reservation_id]; end if;
  foreach v_id in array v_ids loop
    select * into v_row from public.reservations where id=v_id;
    if not found then continue; end if; -- DELETE de la cabecera con CASCADE.
    select count(*),coalesce(sum(i.quantity::numeric*i.unit_price),0)
      into v_count,v_sum from public.reservation_items i where i.reservation_id=v_id;
    select * into v_first from public.reservation_items where reservation_id=v_id order by product_id limit 1;
    if v_count=0 or v_row.items_subtotal is distinct from v_sum
      or v_row.product_id is distinct from v_first.product_id
      or v_row.quantity is distinct from v_first.quantity
      or v_row.unit_price is distinct from v_first.unit_price
      or v_row.inventory_mode is distinct from v_first.inventory_mode_snapshot then
      raise exception 'reservation_items_integrity_invalid' using errcode='23514';
    end if;
  end loop;
  return null;
end;
$$;
revoke all on function private.check_reservation_items_integrity() from public,anon,authenticated;
drop trigger if exists reservations_items_integrity on public.reservations;
create constraint trigger reservations_items_integrity
  after insert or update on public.reservations deferrable initially deferred
  for each row execute function private.check_reservation_items_integrity();
drop trigger if exists reservation_items_integrity on public.reservation_items;
create constraint trigger reservation_items_integrity
  after insert or update or delete on public.reservation_items deferrable initially deferred
  for each row execute function private.check_reservation_items_integrity();

-- Los triggers diferidos no comprueban retroactivamente filas anteriores.
do $$ begin
  if exists (
    select 1 from public.reservations r
    left join lateral (
      select count(*) as item_count,sum(i.quantity::numeric*i.unit_price) as subtotal
      from public.reservation_items i where i.reservation_id=r.id
    ) totals on true
    left join lateral (
      select i.* from public.reservation_items i where i.reservation_id=r.id order by i.product_id limit 1
    ) first_item on true
    where totals.item_count=0 or r.items_subtotal is distinct from totals.subtotal
      or r.product_id is distinct from first_item.product_id
      or r.quantity is distinct from first_item.quantity
      or r.unit_price is distinct from first_item.unit_price
      or r.inventory_mode is distinct from first_item.inventory_mode_snapshot
  ) then raise exception 'reservation_items_integrity_invalid' using errcode='23514'; end if;
end $$;

-- El guard histórico miraba solamente reservations.product_id. Ahora protege
-- también productos secundarios, sin bloquear cabeceras desde un producto.
create or replace function private.guard_product_inventory_mode()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.inventory_mode is distinct from old.inventory_mode and exists (
    select 1 from public.reservation_items i
    join public.reservations r on r.id=i.reservation_id
    where i.product_id=old.id
      and (r.status in ('CONFIRMED','READY') or (r.status='PENDING' and r.expires_at>clock_timestamp()))
  ) then raise exception 'product_inventory_mode_reserved' using errcode='22023'; end if;
  return new;
end;
$$;
revoke all on function private.guard_product_inventory_mode() from public,anon,authenticated;

-- Nueva creación: acepta sólo identidad y cantidades. Precios, comercio, modo,
-- mínimo, subtotal, envío y total siempre salen del catálogo de PostgreSQL.
create or replace function public.create_my_order(
  p_reservation_id uuid,p_items jsonb,p_delivery_type public.delivery_type,p_checkout jsonb default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=auth.uid(); v_entry jsonb; v_quantity numeric; v_product_id uuid;
  v_items jsonb:='[]'::jsonb; v_saved_items jsonb; v_snapshots jsonb:='[]'::jsonb;
  v_product public.products%rowtype; v_first public.products%rowtype;
  v_business public.businesses%rowtype; v_business_id uuid;
  v_existing public.reservations%rowtype; v_snapshot private.reservation_checkout%rowtype;
  v_key text; v_phone text; v_checkout jsonb; v_subtotal numeric:=0;
  v_delivery numeric; v_total numeric; v_now timestamptz;
begin
  if v_user is null then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  -- Serializa reintentos de un mismo comprador sin confiar en el UUID como dueño.
  perform id from public.profiles where id=v_user for update;
  if not found then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  if p_reservation_id is null or p_delivery_type is null then
    raise exception 'reservation_invalid_input' using errcode='22023';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'reservation_items_invalid' using errcode='22023';
  end if;
  if jsonb_array_length(p_items) not between 1 and 100 then
    raise exception 'reservation_items_invalid' using errcode='22023';
  end if;
  for v_entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_entry) is distinct from 'object'
      or (v_entry-array['product_id','quantity'])<>'{}'::jsonb
      or jsonb_typeof(v_entry->'product_id') is distinct from 'string'
      or jsonb_typeof(v_entry->'quantity') is distinct from 'number'
      or (v_entry->>'product_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'reservation_items_invalid' using errcode='22023';
    end if;
    v_quantity:=(v_entry->>'quantity')::numeric;
    if v_quantity not between 1 and 2147483647 or v_quantity<>trunc(v_quantity) then
      raise exception 'reservation_items_invalid' using errcode='22023';
    end if;
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'product_id',(v_entry->>'product_id')::uuid,'quantity',v_quantity::integer));
  end loop;
  -- Un producto aparece una vez; no hay cantidades ambiguas ni descuento doble.
  if (select count(distinct item.product_id) from jsonb_to_recordset(v_items) as item(product_id uuid,quantity integer))
    <>jsonb_array_length(v_items) then raise exception 'reservation_items_invalid' using errcode='22023'; end if;
  select jsonb_agg(jsonb_build_object('product_id',item.product_id,'quantity',item.quantity) order by item.product_id)
    into v_items from jsonb_to_recordset(v_items) as item(product_id uuid,quantity integer);

  select * into v_existing from public.reservations where id=p_reservation_id;
  if v_existing.id is not null then
    if v_existing.buyer_id is distinct from v_user then raise exception 'reservation_forbidden' using errcode='42501'; end if;
    select jsonb_agg(jsonb_build_object('product_id',i.product_id,'quantity',i.quantity) order by i.product_id)
      into v_saved_items from public.reservation_items i where i.reservation_id=v_existing.id;
    if v_saved_items is distinct from v_items or v_existing.delivery_type is distinct from p_delivery_type then
      raise exception 'reservation_retry_mismatch' using errcode='22023';
    end if;
    select * into v_snapshot from private.reservation_checkout where reservation_id=v_existing.id;
    -- Reintento histórico sin checkout: no inventa datos ni altera la reserva.
    if v_snapshot.reservation_id is null and p_checkout is null then return v_existing.id; end if;
  end if;

  -- Misma normalización y snapshot privado del checkout vigente.
  if jsonb_typeof(p_checkout) is distinct from 'object'
    or (p_checkout-array['customer_name','customer_phone','delivery_address','delivery_city','delivery_reference','customer_notes','payment_method'])<>'{}'::jsonb then
    raise exception 'reservation_checkout_invalid' using errcode='22023';
  end if;
  foreach v_key in array array['customer_name','customer_phone','payment_method'] loop
    if jsonb_typeof(p_checkout->v_key) is distinct from 'string' then
      raise exception 'reservation_checkout_invalid' using errcode='22023';
    end if;
  end loop;
  foreach v_key in array array['delivery_address','delivery_city','delivery_reference','customer_notes'] loop
    if coalesce(jsonb_typeof(p_checkout->v_key),'null') not in ('string','null') then
      raise exception 'reservation_checkout_invalid' using errcode='22023';
    end if;
  end loop;
  if length(btrim(p_checkout->>'customer_name')) not between 1 and 160
    or length(p_checkout->>'customer_phone')>40
    or (p_checkout->>'customer_phone') !~ '^\+?[0-9 ()-]+$'
    or (p_checkout->>'payment_method') not in ('CASH','TRANSFER','ARRANGE')
    or length(btrim(coalesce(p_checkout->>'delivery_address','')))>240
    or length(btrim(coalesce(p_checkout->>'delivery_city','')))>120
    or length(btrim(coalesce(p_checkout->>'delivery_reference','')))>500
    or length(btrim(coalesce(p_checkout->>'customer_notes','')))>1000 then
    raise exception 'reservation_checkout_invalid' using errcode='22023';
  end if;
  v_phone:=regexp_replace(p_checkout->>'customer_phone','[^0-9]','','g');
  if left(v_phone,2)='00' then v_phone:=substr(v_phone,3); end if;
  if left(p_checkout->>'customer_phone',1)='+' and left(v_phone,2)<>'54' then
    raise exception 'reservation_checkout_phone_invalid' using errcode='22023';
  end if;
  if length(v_phone)=11 and left(v_phone,1)='0' then v_phone:=substr(v_phone,2); end if;
  if length(v_phone)=10 then v_phone:='54'||v_phone; end if;
  if v_phone !~ '^54(9)?[1-9][0-9]{9}$' then
    raise exception 'reservation_checkout_phone_invalid' using errcode='22023';
  end if;
  if p_delivery_type='DELIVERY' and (
    length(btrim(coalesce(p_checkout->>'delivery_address',''))) not between 1 and 240
    or length(btrim(coalesce(p_checkout->>'delivery_city',''))) not between 1 and 120
  ) then raise exception 'reservation_checkout_address_required' using errcode='22023'; end if;
  v_checkout:=jsonb_build_object(
    'customer_name',btrim(p_checkout->>'customer_name'),'customer_phone',v_phone,
    'payment_method',p_checkout->>'payment_method',
    'delivery_address',case when p_delivery_type='DELIVERY' then btrim(p_checkout->>'delivery_address') end,
    'delivery_city',case when p_delivery_type='DELIVERY' then btrim(p_checkout->>'delivery_city') end,
    'delivery_reference',case when p_delivery_type='DELIVERY' then nullif(btrim(p_checkout->>'delivery_reference'),'') end,
    'customer_notes',nullif(btrim(p_checkout->>'customer_notes'),'')
  );
  if v_existing.id is not null then
    if v_snapshot.reservation_id is null or
      (to_jsonb(v_snapshot)-array['reservation_id','transfer_alias','pickup_address','pickup_city']) is distinct from v_checkout then
      raise exception 'reservation_retry_mismatch' using errcode='22023';
    end if;
    return v_existing.id;
  end if;

  v_product_id:=(v_items->0->>'product_id')::uuid;
  select business_id into v_business_id from public.products where id=v_product_id;
  if not found then raise exception 'reservation_product_unavailable' using errcode='22023'; end if;
  select * into v_business from public.businesses where id=v_business_id for share;
  if v_business.id is null or not v_business.active then
    raise exception 'reservation_product_unavailable' using errcode='22023';
  end if;
  -- Comercio primero; productos en UUID ascendente. Los locks se retienen hasta
  -- COMMIT y protegen precio/modo/actividad mientras se toman todos los snapshots.
  for v_entry in select value from jsonb_array_elements(v_items) order by (value->>'product_id')::uuid loop
    v_product_id:=(v_entry->>'product_id')::uuid;
    select * into v_product from public.products where id=v_product_id for share;
    if v_product.id is null or not v_product.active then
      raise exception 'reservation_product_unavailable' using errcode='22023';
    end if;
    if v_product.business_id is distinct from v_business.id then
      raise exception 'reservation_items_mixed_business' using errcode='22023';
    end if;
    if v_first.id is null then v_first:=v_product; end if;
    v_quantity:=(v_entry->>'quantity')::integer;
    if v_product.inventory_mode='ON_DEMAND' then
      if not v_product.available_today then raise exception 'reservation_availability_unavailable' using errcode='22023'; end if;
    elsif v_product.stock_quantity<v_quantity then
      raise exception 'reservation_stock_insufficient' using errcode='22023';
    end if;
    if (p_delivery_type='PICKUP' and not (v_product.pickup_enabled and v_business.pickup_enabled))
      or (p_delivery_type='DELIVERY' and not (v_product.delivery_enabled and v_business.delivery_enabled)) then
      raise exception 'reservation_delivery_unavailable' using errcode='22023';
    end if;
    v_subtotal:=v_subtotal+v_quantity*v_product.price;
    v_snapshots:=v_snapshots||jsonb_build_array(jsonb_build_object(
      'product_id',v_product.id,'quantity',v_quantity::integer,'unit_price',v_product.price,
      'product_name_snapshot',v_product.name,'inventory_mode_snapshot',v_product.inventory_mode));
  end loop;
  if v_subtotal<v_business.minimum_order then
    raise exception 'reservation_minimum_order_not_met' using errcode='22023';
  end if;
  if ((v_checkout->>'payment_method')='CASH' and not v_business.accepts_cash)
    or ((v_checkout->>'payment_method')='TRANSFER' and not v_business.accepts_transfer) then
    raise exception 'reservation_payment_unavailable' using errcode='22023';
  end if;
  v_delivery:=case when p_delivery_type='DELIVERY' then v_business.delivery_price else 0 end;
  v_total:=v_subtotal+v_delivery;
  if v_total>99999999999999999999.99 then
    raise exception 'reservation_total_limit' using errcode='22023';
  end if;
  v_now:=clock_timestamp();
  insert into public.reservations(id,buyer_id,business_id,product_id,quantity,unit_price,items_subtotal,
    delivery_price,total,delivery_type,status,created_at,expires_at,inventory_mode)
  values(p_reservation_id,v_user,v_business.id,v_first.id,(v_items->0->>'quantity')::integer,v_first.price,
    v_subtotal,v_delivery,v_total,p_delivery_type,'PENDING',v_now,v_now+interval '30 minutes',v_first.inventory_mode);
  insert into public.reservation_items(reservation_id,business_id,product_id,quantity,unit_price,
    product_name_snapshot,inventory_mode_snapshot,created_at)
  select p_reservation_id,v_business.id,item.product_id,item.quantity,item.unit_price,
    item.product_name_snapshot,item.inventory_mode_snapshot,v_now
  from jsonb_to_recordset(v_snapshots) as item(product_id uuid,quantity integer,unit_price numeric,
    product_name_snapshot text,inventory_mode_snapshot text);
  insert into private.reservation_checkout(reservation_id,customer_name,customer_phone,delivery_address,
    delivery_city,delivery_reference,customer_notes,payment_method,transfer_alias,pickup_address,pickup_city)
  values(p_reservation_id,v_checkout->>'customer_name',v_phone,v_checkout->>'delivery_address',v_checkout->>'delivery_city',
    v_checkout->>'delivery_reference',v_checkout->>'customer_notes',v_checkout->>'payment_method',
    case when (v_checkout->>'payment_method')='TRANSFER' then v_business.transfer_alias end,v_business.address,v_business.city);
  -- Un checkout, un envío y un estado para todos los items. No descuenta stock.
  return p_reservation_id;
end;
$$;

-- Misma firma del cliente actual: siempre crea un pedido de un solo item usando
-- la misma implementación, privacidad, mínimo e idempotencia que el nuevo flujo.
create or replace function public.create_my_reservation(
  p_reservation_id uuid,p_product_id uuid,p_quantity integer,p_delivery_type public.delivery_type,p_checkout jsonb default null
) returns uuid language sql security definer set search_path='' as $$
  select public.create_my_order(p_reservation_id,
    jsonb_build_array(jsonb_build_object('product_id',p_product_id,'quantity',p_quantity)),p_delivery_type,p_checkout);
$$;

create or replace function public.manage_my_reservation(p_reservation_id uuid,p_action text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_row public.reservations%rowtype; v_business public.businesses%rowtype;
  v_product public.products%rowtype; v_item public.reservation_items%rowtype;
  v_owner boolean; v_next integer; v_now timestamptz;
begin
  if auth.uid() is null then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  if p_action is null or p_action not in ('confirm','cancel','ready','complete') then
    raise exception 'reservation_invalid_input' using errcode='22023';
  end if;
  -- Todas las transiciones y reintentos serializan por cabecera.
  select * into v_row from public.reservations where id=p_reservation_id for update;
  if not found then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  v_owner:=private.owns_business(v_row.business_id);
  if (p_action='cancel' and not (v_owner or v_row.buyer_id=auth.uid()))
    or (p_action<>'cancel' and not v_owner) then raise exception 'reservation_forbidden' using errcode='42501'; end if;
  if (p_action='confirm' and v_row.status='CONFIRMED') or (p_action='cancel' and v_row.status='CANCELLED')
    or (p_action='ready' and v_row.status='READY') or (p_action='complete' and v_row.status='COMPLETED') then return v_row.id; end if;
  if v_row.status='PENDING' and v_row.expires_at<=clock_timestamp() then
    raise exception 'reservation_state_changed' using errcode='22023';
  end if;
  if (p_action='confirm' and v_row.status<>'PENDING')
    or (p_action='cancel' and v_row.status not in ('PENDING','CONFIRMED'))
    or (p_action='ready' and v_row.status<>'CONFIRMED')
    or (p_action='complete' and v_row.status<>'READY') then
    raise exception 'reservation_state_changed' using errcode='22023';
  end if;
  if not exists (select 1 from public.reservation_items where reservation_id=v_row.id) then
    raise exception 'reservation_items_integrity_invalid' using errcode='23514';
  end if;

  if p_action='confirm' or (p_action='cancel' and v_row.status='CONFIRMED') then
    select * into v_business from public.businesses where id=v_row.business_id for share;
    if v_business.id is null or (p_action='confirm' and not v_business.active) then
      raise exception 'reservation_product_unavailable' using errcode='22023';
    end if;
    -- Primera pasada: bloquear TODOS los productos (incluidos a pedido para
    -- proteger modo/disponibilidad), validar TODO, sin modificar stock todavía.
    for v_item in select * from public.reservation_items where reservation_id=v_row.id order by product_id loop
      select * into v_product from public.products
        where id=v_item.product_id and business_id=v_row.business_id for update;
      if v_product.id is null or v_product.inventory_mode is distinct from v_item.inventory_mode_snapshot then
        raise exception 'reservation_product_unavailable' using errcode='22023';
      end if;
      if p_action='confirm' then
        if not v_product.active then raise exception 'reservation_product_unavailable' using errcode='22023'; end if;
        if v_item.inventory_mode_snapshot='ON_DEMAND' then
          if not v_product.available_today then raise exception 'reservation_availability_unavailable' using errcode='22023'; end if;
        elsif v_product.stock_quantity<v_item.quantity then
          raise exception 'reservation_confirm_stock_insufficient' using errcode='22023';
        end if;
      elsif v_item.stock_deducted and v_product.stock_quantity::bigint+v_item.quantity>2147483647 then
        raise exception 'reservation_stock_limit' using errcode='22023';
      end if;
    end loop;
    -- Vencimiento revalidado DESPUÉS de adquirir el último lock.
    if p_action='confirm' and v_row.expires_at<=clock_timestamp() then
      raise exception 'reservation_state_changed' using errcode='22023';
    end if;
    -- Segunda pasada: todos los locks siguen retenidos. Si un UPDATE falla,
    -- PostgreSQL revierte el conjunto, nunca quedan descuentos parciales.
    for v_item in select * from public.reservation_items
      where reservation_id=v_row.id and inventory_mode_snapshot='STOCKED' order by product_id loop
      if p_action='cancel' and not v_item.stock_deducted then continue; end if;
      select stock_quantity into v_next from public.products where id=v_item.product_id;
      v_next:=case when p_action='confirm' then v_next-v_item.quantity else v_next+v_item.quantity end;
      update public.products set stock_quantity=v_next,
        stock_status=case when v_next=0 then 'OUT_OF_STOCK'::public.stock_status
          when v_next<=2 then 'LOW_STOCK'::public.stock_status else 'IN_STOCK'::public.stock_status end,
        stock_confirmed_at=clock_timestamp() where id=v_item.product_id;
      update public.reservation_items set stock_deducted=(p_action='confirm') where id=v_item.id;
    end loop;
  end if;
  v_now:=clock_timestamp();
  if p_action='confirm' then update public.reservations set status='CONFIRMED',confirmed_at=v_now where id=v_row.id;
  elsif p_action='cancel' then update public.reservations set status='CANCELLED',cancelled_at=v_now where id=v_row.id;
  elsif p_action='ready' then update public.reservations set status='READY',ready_at=v_now where id=v_row.id;
  else update public.reservations set status='COMPLETED',completed_at=v_now where id=v_row.id; end if;
  return v_row.id;
end;
$$;

-- Sólo cambia el retorno, no los parámetros ni las reglas de visibilidad del
-- checkout. Snapshot de nombre/precio/modo permanece aunque cambie el catálogo.
drop function public.read_my_reservations(boolean,uuid,integer,integer);
create function public.read_my_reservations(
  p_seller boolean default false,p_reservation_id uuid default null,p_offset integer default 0,p_limit integer default 100
) returns table(id uuid,business_id uuid,product_id uuid,quantity integer,unit_price numeric,delivery_price numeric,total numeric,
  delivery_type public.delivery_type,status public.reservation_status,created_at timestamptz,expires_at timestamptz,
  confirmed_at timestamptz,ready_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,
  product_name text,business_name text,product_image text,current_stock integer,inventory_mode text,
  customer_name text,customer_phone text,delivery_address text,delivery_city text,delivery_reference text,
  customer_notes text,payment_method text,transfer_alias text,pickup_address text,pickup_city text,
  items jsonb,items_subtotal numeric)
language sql stable security definer set search_path='' as $$
  select r.id,r.business_id,r.product_id,r.quantity,r.unit_price,r.delivery_price,r.total,r.delivery_type,r.status,
    r.created_at,r.expires_at,r.confirmed_at,r.ready_at,r.completed_at,r.cancelled_at,
    anchor.product_name_snapshot,b.name,
    (select image.url from public.product_images image where image.product_id=p.id order by image.position,image.id limit 1),
    p.stock_quantity,r.inventory_mode,x.customer_name,
    case when not p_seller or visibility.released then x.customer_phone end,
    case when not p_seller or visibility.released then x.delivery_address end,
    x.delivery_city,
    case when not p_seller or visibility.released then x.delivery_reference end,
    case when not p_seller or visibility.released then x.customer_notes end,
    x.payment_method,
    case when visibility.released and x.payment_method='TRANSFER' then x.transfer_alias end,
    coalesce(x.pickup_address,b.address),coalesce(x.pickup_city,b.city),
    (
      select jsonb_agg(jsonb_build_object(
        'id',i.id,'reservation_id',i.reservation_id,'product_id',i.product_id,
        'product_name_snapshot',i.product_name_snapshot,'quantity',i.quantity,'unit_price',i.unit_price,
        'inventory_mode_snapshot',i.inventory_mode_snapshot,'subtotal',i.quantity::numeric*i.unit_price,
        'product_image',(select image.url from public.product_images image where image.product_id=i.product_id order by image.position,image.id limit 1),
        'current_stock',product.stock_quantity,'created_at',i.created_at
      ) order by i.product_id)
      from public.reservation_items i join public.products product on product.id=i.product_id
      where i.reservation_id=r.id
    ),r.items_subtotal
  from public.reservations r
  join public.products p on p.id=r.product_id
  join public.businesses b on b.id=r.business_id
  join public.reservation_items anchor on anchor.reservation_id=r.id and anchor.product_id=r.product_id
  left join private.reservation_checkout x on x.reservation_id=r.id
  cross join lateral (select r.confirmed_at is not null and r.status in ('CONFIRMED','READY','COMPLETED') as released) visibility
  where auth.uid() is not null and ((p_seller is true and b.owner_id=auth.uid()) or (p_seller is false and r.buyer_id=auth.uid()))
    and (p_reservation_id is null or r.id=p_reservation_id)
  order by r.created_at desc,r.id
  limit greatest(1,least(coalesce(p_limit,100),100)) offset greatest(0,coalesce(p_offset,0));
$$;

revoke all on function public.create_my_order(uuid,jsonb,public.delivery_type,jsonb) from public,anon,authenticated;
revoke all on function public.create_my_reservation(uuid,uuid,integer,public.delivery_type,jsonb) from public,anon,authenticated;
revoke all on function public.manage_my_reservation(uuid,text) from public,anon,authenticated;
revoke all on function public.read_my_reservations(boolean,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_my_order(uuid,jsonb,public.delivery_type,jsonb) to authenticated;
grant execute on function public.create_my_reservation(uuid,uuid,integer,public.delivery_type,jsonb) to authenticated;
grant execute on function public.manage_my_reservation(uuid,text) to authenticated;
grant execute on function public.read_my_reservations(boolean,uuid,integer,integer) to authenticated;

-- No se altera publicación, trigger ni payload Realtime de la cabecera. El
-- cliente recibe el aviso actual y reconsulta esta proyección con todos los items.
notify pgrst,'reload schema';
commit;

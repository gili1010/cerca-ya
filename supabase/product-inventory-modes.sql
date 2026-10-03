-- Delta: ejecutar DESPUÉS de product-rls.sql y reservation-rls.sql ya aplicados.
-- No volver a ejecutar las migraciones históricas: restaurarían la lógica anterior.
-- No cambia RLS, Realtime, estados de reservas ni productos existentes de modo.
begin;

alter table public.products
  add column if not exists inventory_mode text not null default 'STOCKED',
  add column if not exists available_today boolean not null default false,
  add column if not exists availability_confirmed_at timestamptz;
alter table public.reservations add column if not exists inventory_mode text not null default 'STOCKED';

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_inventory_mode_check') then
    alter table public.products add constraint products_inventory_mode_check check (inventory_mode in ('STOCKED','ON_DEMAND'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_on_demand_stock_check') then
    alter table public.products add constraint products_on_demand_stock_check check (inventory_mode = 'STOCKED' or stock_quantity = 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.reservations'::regclass and conname = 'reservations_inventory_mode_check') then
    alter table public.reservations add constraint reservations_inventory_mode_check check (inventory_mode in ('STOCKED','ON_DEMAND'));
  end if;
end $$;

grant insert (inventory_mode,available_today,availability_confirmed_at),
  update (inventory_mode,available_today,availability_confirmed_at) on public.products to authenticated;

-- El bloqueo de la fila del producto serializa esto con crear/confirmar/cancelar.
-- Evita que un cambio de modo pierda o reponga unidades de una reserva en curso.
create or replace function private.guard_product_inventory_mode()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.inventory_mode is distinct from old.inventory_mode and exists (
    select 1 from public.reservations r where r.product_id = old.id
      and (r.status in ('CONFIRMED','READY') or (r.status = 'PENDING' and r.expires_at > clock_timestamp()))
  ) then
    raise exception 'product_inventory_mode_reserved' using errcode = '22023';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_product_inventory_mode() from public,anon,authenticated;
drop trigger if exists products_guard_inventory_mode on public.products;
create trigger products_guard_inventory_mode before update of inventory_mode on public.products
  for each row execute function private.guard_product_inventory_mode();

create or replace function public.save_my_product(p_input jsonb, p_product_id uuid default null)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_business_id uuid;
  v_old public.products;
  v_id uuid;
  v_category_id uuid;
  v_name text;
  v_price numeric;
  v_stock numeric;
  v_status public.stock_status;
  v_key text;
  v_mode text;
  v_available boolean;
begin
  if auth.uid() is null then raise exception 'product_auth_required' using errcode = '42501'; end if;
  select id into v_business_id from public.businesses where owner_id = auth.uid();
  if v_business_id is null then raise exception 'product_business_required' using errcode = '42501'; end if;

  -- No business_id parameter: ownership always comes from the authenticated user.
  if jsonb_typeof(p_input) is distinct from 'object' or
    (p_input - array['name','description','category_id','brand','model','sku','price','stock_quantity','inventory_mode','available_today','pickup_enabled','delivery_enabled','active']) <> '{}'::jsonb then
    raise exception 'product_invalid_input' using errcode = '22023';
  end if;
  foreach v_key in array array['name','category_id'] loop
    if jsonb_typeof(p_input -> v_key) is distinct from 'string' then
      raise exception 'product_invalid_input' using errcode = '22023';
    end if;
  end loop;
  foreach v_key in array array['description','brand','model','sku'] loop
    if coalesce(jsonb_typeof(p_input -> v_key), 'null') not in ('string','null') then
      raise exception 'product_invalid_input' using errcode = '22023';
    end if;
  end loop;
  foreach v_key in array array['pickup_enabled','delivery_enabled','active'] loop
    if jsonb_typeof(p_input -> v_key) is distinct from 'boolean' then
      raise exception 'product_invalid_input' using errcode = '22023';
    end if;
  end loop;
  v_mode := coalesce(p_input ->> 'inventory_mode', 'STOCKED');
  if v_mode not in ('STOCKED','ON_DEMAND')
    or (p_input ? 'inventory_mode' and jsonb_typeof(p_input -> 'inventory_mode') is distinct from 'string')
    or (v_mode = 'ON_DEMAND' and jsonb_typeof(p_input -> 'available_today') is distinct from 'boolean') then
    raise exception 'product_invalid_input' using errcode = '22023';
  end if;
  v_available := v_mode = 'ON_DEMAND' and coalesce((p_input ->> 'available_today')::boolean, false);
  if jsonb_typeof(p_input -> 'price') is distinct from 'number' or
    (v_mode = 'STOCKED' and jsonb_typeof(p_input -> 'stock_quantity') is distinct from 'number') then
    raise exception 'product_invalid_numbers' using errcode = '22023';
  end if;
  v_name := btrim(p_input ->> 'name');
  v_price := (p_input ->> 'price')::numeric;
  v_stock := case when v_mode = 'ON_DEMAND' then 0 else (p_input ->> 'stock_quantity')::numeric end;
  if length(v_name) not between 1 and 160 or length(coalesce(p_input ->> 'description','')) > 5000
    or length(coalesce(p_input ->> 'brand','')) > 160 or length(coalesce(p_input ->> 'model','')) > 160
    or length(coalesce(p_input ->> 'sku','')) > 100 then
    raise exception 'product_invalid_input' using errcode = '22023';
  end if;
  if v_price not between 0 and 9999999999.99 or v_price <> round(v_price, 2)
    or v_stock not between 0 and 2147483647 or v_stock <> trunc(v_stock) then
    raise exception 'product_invalid_numbers' using errcode = '22023';
  end if;
  v_category_id := (p_input ->> 'category_id')::uuid;
  if not exists (select 1 from public.categories where id = v_category_id) then
    raise exception 'product_invalid_category' using errcode = '22023';
  end if;
  v_status := case when v_mode = 'ON_DEMAND' then 'UNCONFIRMED'::public.stock_status when v_stock > 0 then 'IN_STOCK'::public.stock_status else 'OUT_OF_STOCK'::public.stock_status end;

  if p_product_id is null then
    insert into public.products (business_id, category_id, name, description, brand, model, sku,
      price, stock_quantity, stock_status, stock_confirmed_at, inventory_mode, available_today, availability_confirmed_at, pickup_enabled, delivery_enabled, active)
    values (v_business_id, v_category_id, v_name, btrim(coalesce(p_input ->> 'description','')),
      nullif(btrim(p_input ->> 'brand'),''), nullif(btrim(p_input ->> 'model'),''), nullif(btrim(p_input ->> 'sku'),''),
      v_price, v_stock::integer, v_status, case when v_mode = 'STOCKED' then now() end,
      v_mode, v_available, case when v_mode = 'ON_DEMAND' then now() end, (p_input ->> 'pickup_enabled')::boolean,
      (p_input ->> 'delivery_enabled')::boolean, true)
    returning id into v_id;
  else
    select * into v_old from public.products
      where id = p_product_id and business_id = v_business_id for update;
    if not found then raise exception 'product_not_owned' using errcode = '42501'; end if;
    update public.products set category_id = v_category_id, name = v_name,
      description = btrim(coalesce(p_input ->> 'description','')),
      brand = nullif(btrim(p_input ->> 'brand'),''), model = nullif(btrim(p_input ->> 'model'),''), sku = nullif(btrim(p_input ->> 'sku'),''),
      price = v_price, stock_quantity = v_stock::integer, stock_status = v_status,
      inventory_mode = v_mode, available_today = v_available,
      availability_confirmed_at = case when v_mode = 'ON_DEMAND' then now() end,
      stock_confirmed_at = case when v_mode = 'ON_DEMAND' then null
        when v_old.inventory_mode is distinct from v_mode or v_old.stock_quantity is distinct from v_stock::integer then now() else v_old.stock_confirmed_at end,
      pickup_enabled = (p_input ->> 'pickup_enabled')::boolean, delivery_enabled = (p_input ->> 'delivery_enabled')::boolean,
      active = (p_input ->> 'active')::boolean
      where id = p_product_id and business_id = v_business_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.manage_my_product(p_product_id uuid, p_action text)
returns public.products
language plpgsql security invoker set search_path = '' as $$
declare
  v_business_id uuid;
  v_product public.products;
begin
  if auth.uid() is null then raise exception 'product_auth_required' using errcode = '42501'; end if;
  select id into v_business_id from public.businesses where owner_id = auth.uid();
  if v_business_id is null then raise exception 'product_business_required' using errcode = '42501'; end if;
  if p_action = 'confirm_stock' then
    -- Quantity/status/active stay intact; existing audit trigger also updates updated_at.
    update public.products set
      stock_confirmed_at = case when inventory_mode = 'STOCKED' then now() else stock_confirmed_at end,
      availability_confirmed_at = case when inventory_mode = 'ON_DEMAND' then now() else availability_confirmed_at end
      where id = p_product_id and business_id = v_business_id returning * into v_product;
  elsif p_action in ('activate', 'deactivate') then
    update public.products set active = (p_action = 'activate')
      where id = p_product_id and business_id = v_business_id returning * into v_product;
  else
    raise exception 'product_invalid_action' using errcode = '22023';
  end if;
  if v_product.id is null then raise exception 'product_not_owned' using errcode = '42501'; end if;
  return v_product;
end;
$$;

revoke all on function public.save_my_product(jsonb, uuid) from public, anon;
revoke all on function public.manage_my_product(uuid, text) from public, anon;
grant execute on function public.save_my_product(jsonb, uuid) to authenticated;
grant execute on function public.manage_my_product(uuid, text) to authenticated;


create or replace function public.create_my_reservation(p_reservation_id uuid, p_product_id uuid, p_quantity integer, p_delivery_type public.delivery_type)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 v_user uuid := auth.uid(); v_product public.products%rowtype; v_business public.businesses%rowtype;
 v_existing public.reservations%rowtype; v_business_id uuid; v_now timestamptz;
begin
 if v_user is null then raise exception 'reservation_forbidden' using errcode='42501'; end if;
 -- Serializa reintentos de esta cuenta. El UUID es una clave de idempotencia, no un propietario.
 perform id from public.profiles where id = v_user for update;
 if not found then raise exception 'reservation_forbidden' using errcode='42501'; end if;
 select * into v_existing from public.reservations where id=p_reservation_id and buyer_id=v_user;
 if found then
   if v_existing.product_id <> p_product_id or v_existing.quantity <> p_quantity or v_existing.delivery_type <> p_delivery_type then
     raise exception 'reservation_retry_mismatch' using errcode='22023';
   end if;
   return v_existing.id;
 end if;
 if p_reservation_id is null or p_quantity is null or p_quantity < 1 or p_delivery_type is null then
   raise exception 'reservation_invalid_input' using errcode='22023';
 end if;
 select business_id into v_business_id from public.products where id=p_product_id;
 if not found then raise exception 'reservation_product_unavailable' using errcode='22023'; end if;
 -- Orden compatible con la edición del catálogo: negocio y luego producto.
 select * into v_business from public.businesses where id=v_business_id for share;
 select * into v_product from public.products where id=p_product_id for share;
 if not found or not v_product.active or not v_business.active then
   raise exception 'reservation_product_unavailable' using errcode='22023';
 end if;
 if v_product.inventory_mode = 'ON_DEMAND' then
   if not v_product.available_today then raise exception 'reservation_availability_unavailable' using errcode='22023'; end if;
 elsif v_product.stock_quantity < p_quantity then
   raise exception 'reservation_stock_insufficient' using errcode='22023';
 end if;
 if (p_delivery_type='PICKUP' and not (v_product.pickup_enabled and v_business.pickup_enabled))
   or (p_delivery_type='DELIVERY' and not (v_product.delivery_enabled and v_business.delivery_enabled)) then
   raise exception 'reservation_delivery_unavailable' using errcode='22023';
 end if;
 v_now := clock_timestamp();
 insert into public.reservations(id,buyer_id,business_id,product_id,quantity,unit_price,delivery_price,delivery_type,status,created_at,expires_at,inventory_mode)
 values(p_reservation_id,v_user,v_product.business_id,v_product.id,p_quantity,v_product.price,
   case when p_delivery_type='DELIVERY' then v_business.delivery_price else 0 end,p_delivery_type,'PENDING',v_now,v_now+interval '30 minutes',v_product.inventory_mode);
 -- total es GENERATED en el esquema. No se descuenta stock al crear.
 return p_reservation_id;
end;
$$;

create or replace function public.manage_my_reservation(p_reservation_id uuid, p_action text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.reservations%rowtype; v_product public.products%rowtype; v_owner boolean; v_stock integer; v_next integer; v_now timestamptz;
begin
 if auth.uid() is null then raise exception 'reservation_forbidden' using errcode='42501'; end if;
 if p_action is null or p_action not in ('confirm','cancel','ready','complete') then
   raise exception 'reservation_invalid_input' using errcode='22023';
 end if;
 -- Todos los cambios bloquean primero la reserva. Confirmar/cancelar comparten orden.
 select * into v_row from public.reservations where id=p_reservation_id for update;
 if not found then raise exception 'reservation_forbidden' using errcode='42501'; end if;
 v_owner := private.owns_business(v_row.business_id);
 if (p_action='cancel' and not (v_owner or v_row.buyer_id=auth.uid()))
   or (p_action<>'cancel' and not v_owner) then raise exception 'reservation_forbidden' using errcode='42501'; end if;
 -- Reintentos idempotentes: nunca descuentan ni devuelven stock dos veces.
 if (p_action='confirm' and v_row.status='CONFIRMED') or (p_action='cancel' and v_row.status='CANCELLED')
   or (p_action='ready' and v_row.status='READY') or (p_action='complete' and v_row.status='COMPLETED') then return v_row.id; end if;
 if v_row.status='PENDING' and v_row.expires_at<=clock_timestamp() then raise exception 'reservation_state_changed' using errcode='22023'; end if;
 if (p_action='confirm' and v_row.status<>'PENDING')
   or (p_action='cancel' and v_row.status not in ('PENDING','CONFIRMED'))
   or (p_action='ready' and v_row.status<>'CONFIRMED')
   or (p_action='complete' and v_row.status<>'READY') then raise exception 'reservation_state_changed' using errcode='22023'; end if;
 if p_action='confirm' or (p_action='cancel' and v_row.status='CONFIRMED') then
   select * into v_product from public.products where id=v_row.product_id and business_id=v_row.business_id for update;
   v_stock := v_product.stock_quantity;
   if v_product.id is null or v_product.inventory_mode <> v_row.inventory_mode then
     raise exception 'reservation_product_unavailable' using errcode='22023';
   end if;
   -- Revalidar vencimiento DESPUÉS de esperar el bloqueo del producto.
   if p_action='confirm' then
     if v_row.expires_at<=clock_timestamp() then raise exception 'reservation_state_changed' using errcode='22023'; end if;
     if v_row.inventory_mode = 'ON_DEMAND' then
       if not v_product.active or not v_product.available_today then
         raise exception 'reservation_availability_unavailable' using errcode='22023';
       end if;
     elsif v_stock<v_row.quantity then raise exception 'reservation_confirm_stock_insufficient' using errcode='22023'; end if;
     if v_row.inventory_mode = 'STOCKED' then v_next := v_stock-v_row.quantity; end if;
   else
     if v_row.inventory_mode = 'STOCKED' then
       if v_stock::bigint+v_row.quantity>2147483647 then raise exception 'reservation_stock_limit' using errcode='22023'; end if;
       v_next := v_stock+v_row.quantity;
     end if;
   end if;
   if v_row.inventory_mode = 'STOCKED' then
   update public.products set stock_quantity=v_next,
     stock_status=case when v_next=0 then 'OUT_OF_STOCK'::public.stock_status when v_next<=2 then 'LOW_STOCK'::public.stock_status else 'IN_STOCK'::public.stock_status end,
     stock_confirmed_at=clock_timestamp() where id=v_row.product_id;
   end if;
 end if;
 v_now := clock_timestamp();
 if p_action='confirm' then update public.reservations set status='CONFIRMED',confirmed_at=v_now where id=v_row.id;
 elsif p_action='cancel' then update public.reservations set status='CANCELLED',cancelled_at=v_now where id=v_row.id;
 elsif p_action='ready' then update public.reservations set status='READY',ready_at=v_now where id=v_row.id;
 else update public.reservations set status='COMPLETED',completed_at=v_now where id=v_row.id; end if;
 return v_row.id;
end;
$$;

-- Proyección para ambas partes: permite continuar aunque se desactive el producto.
-- No devuelve perfiles privados ni owner_id/buyer_id.
-- La proyección suma el modo capturado en la reserva; se recrea por cambiar su retorno.
drop function public.read_my_reservations(boolean,uuid,integer,integer);
create function public.read_my_reservations(p_seller boolean default false,p_reservation_id uuid default null,p_offset integer default 0,p_limit integer default 100)
returns table(id uuid,business_id uuid,product_id uuid,quantity integer,unit_price numeric,delivery_price numeric,total numeric,
 delivery_type public.delivery_type,status public.reservation_status,created_at timestamptz,expires_at timestamptz,
 confirmed_at timestamptz,ready_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,
 product_name text,business_name text,product_image text,current_stock integer,inventory_mode text)
language sql stable security definer set search_path = '' as $$
 select r.id,r.business_id,r.product_id,r.quantity,r.unit_price,r.delivery_price,r.total,r.delivery_type,r.status,
 r.created_at,r.expires_at,r.confirmed_at,r.ready_at,r.completed_at,r.cancelled_at,p.name,b.name,
 (select i.url from public.product_images i where i.product_id=p.id order by i.position,i.id limit 1),p.stock_quantity,r.inventory_mode
 from public.reservations r join public.products p on p.id=r.product_id join public.businesses b on b.id=r.business_id
 where auth.uid() is not null and ((p_seller is true and b.owner_id=auth.uid()) or (p_seller is false and r.buyer_id=auth.uid()))
 and (p_reservation_id is null or r.id=p_reservation_id)
 order by r.created_at desc,r.id limit greatest(1,least(coalesce(p_limit,100),100)) offset greatest(0,coalesce(p_offset,0));
$$;
revoke all on function public.create_my_reservation(uuid,uuid,integer,public.delivery_type) from public,anon,authenticated;
revoke all on function public.manage_my_reservation(uuid,text) from public,anon,authenticated;
revoke all on function public.read_my_reservations(boolean,uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.create_my_reservation(uuid,uuid,integer,public.delivery_type) to authenticated;
grant execute on function public.manage_my_reservation(uuid,text) to authenticated;
grant execute on function public.read_my_reservations(boolean,uuid,integer,integer) to authenticated;


commit;


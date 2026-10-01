-- Ejecutar manualmente sobre el esquema existente. No importa localStorage.
begin;
alter table public.reservations enable row level security;
revoke all on public.reservations from public, anon, authenticated;
revoke insert (id,buyer_id,business_id,product_id,quantity,unit_price,delivery_price,total,delivery_type,status,created_at,expires_at,confirmed_at,ready_at,completed_at,cancelled_at),
 update (id,buyer_id,business_id,product_id,quantity,unit_price,delivery_price,total,delivery_type,status,created_at,expires_at,confirmed_at,ready_at,completed_at,cancelled_at)
 on public.reservations from public, anon, authenticated;
grant select on public.reservations to authenticated;
drop policy if exists reservations_buyer_create on public.reservations;
drop policy if exists reservations_buyer_cancel on public.reservations;
drop policy if exists reservations_business_manage on public.reservations;
drop policy if exists reservations_buyer_read on public.reservations;
drop policy if exists reservations_business_read on public.reservations;
create policy reservations_buyer_read on public.reservations for select to authenticated using (buyer_id = (select auth.uid()));
create policy reservations_business_read on public.reservations for select to authenticated using (private.owns_business(business_id));

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
 if v_product.stock_quantity < p_quantity then raise exception 'reservation_stock_insufficient' using errcode='22023'; end if;
 if (p_delivery_type='PICKUP' and not (v_product.pickup_enabled and v_business.pickup_enabled))
   or (p_delivery_type='DELIVERY' and not (v_product.delivery_enabled and v_business.delivery_enabled)) then
   raise exception 'reservation_delivery_unavailable' using errcode='22023';
 end if;
 v_now := clock_timestamp();
 insert into public.reservations(id,buyer_id,business_id,product_id,quantity,unit_price,delivery_price,delivery_type,status,created_at,expires_at)
 values(p_reservation_id,v_user,v_product.business_id,v_product.id,p_quantity,v_product.price,
   case when p_delivery_type='DELIVERY' then v_business.delivery_price else 0 end,p_delivery_type,'PENDING',v_now,v_now+interval '30 minutes');
 -- total es GENERATED en el esquema. No se descuenta stock al crear.
 return p_reservation_id;
end;
$$;

create or replace function public.manage_my_reservation(p_reservation_id uuid, p_action text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_row public.reservations%rowtype; v_owner boolean; v_stock integer; v_next integer; v_now timestamptz;
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
   select stock_quantity into v_stock from public.products where id=v_row.product_id and business_id=v_row.business_id for update;
   if not found then raise exception 'reservation_product_unavailable' using errcode='22023'; end if;
   -- Revalidar vencimiento DESPUÉS de esperar el bloqueo del producto.
   if p_action='confirm' then
     if v_row.expires_at<=clock_timestamp() then raise exception 'reservation_state_changed' using errcode='22023'; end if;
     if v_stock<v_row.quantity then raise exception 'reservation_confirm_stock_insufficient' using errcode='22023'; end if;
     v_next := v_stock-v_row.quantity;
   else
     if v_stock::bigint+v_row.quantity>2147483647 then raise exception 'reservation_stock_limit' using errcode='22023'; end if;
     v_next := v_stock+v_row.quantity;
   end if;
   update public.products set stock_quantity=v_next,
     stock_status=case when v_next=0 then 'OUT_OF_STOCK'::public.stock_status when v_next<=2 then 'LOW_STOCK'::public.stock_status else 'IN_STOCK'::public.stock_status end,
     stock_confirmed_at=clock_timestamp() where id=v_row.product_id;
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
create or replace function public.read_my_reservations(p_seller boolean default false,p_reservation_id uuid default null,p_offset integer default 0,p_limit integer default 100)
returns table(id uuid,business_id uuid,product_id uuid,quantity integer,unit_price numeric,delivery_price numeric,total numeric,
 delivery_type public.delivery_type,status public.reservation_status,created_at timestamptz,expires_at timestamptz,
 confirmed_at timestamptz,ready_at timestamptz,completed_at timestamptz,cancelled_at timestamptz,
 product_name text,business_name text,product_image text,current_stock integer)
language sql stable security definer set search_path = '' as $$
 select r.id,r.business_id,r.product_id,r.quantity,r.unit_price,r.delivery_price,r.total,r.delivery_type,r.status,
 r.created_at,r.expires_at,r.confirmed_at,r.ready_at,r.completed_at,r.cancelled_at,p.name,b.name,
 (select i.url from public.product_images i where i.product_id=p.id order by i.position,i.id limit 1),p.stock_quantity
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

-- Realtime de reservas separado del ya instalado para pedidos/ofertas.
do $$ begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then create publication supabase_realtime; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reservations') then
   alter publication supabase_realtime add table public.reservations;
 end if;
end $$;
create or replace function private.can_receive_reservations(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and (p_topic='buyer-reservations:'||auth.uid()::text
 or exists(select 1 from public.businesses b where b.owner_id=auth.uid() and p_topic='merchant-reservations:'||b.id::text));
$$;
revoke all on function private.can_receive_reservations(text) from public,anon,authenticated;
grant execute on function private.can_receive_reservations(text) to authenticated;
-- realtime.messages ya tiene RLS administrada por Supabase: NO ejecutar ALTER TABLE.
drop policy if exists cercaya_reservations_receive on realtime.messages;
create policy cercaya_reservations_receive on realtime.messages for select to authenticated
 using(extension='broadcast' and private.can_receive_reservations((select realtime.topic())));
drop policy if exists cercaya_reservations_boundary on realtime.messages;
create policy cercaya_reservations_boundary on realtime.messages as restrictive for select to public
 using(topic !~ '^(buyer-reservations|merchant-reservations):' or (extension='broadcast' and private.can_receive_reservations(topic)));
drop policy if exists cercaya_reservations_no_send on realtime.messages;
create policy cercaya_reservations_no_send on realtime.messages as restrictive for insert to public
 with check(topic !~ '^(buyer-reservations|merchant-reservations):');
create or replace function private.emit_reservation_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row public.reservations%rowtype; v_payload jsonb;
begin
 if tg_op='DELETE' then v_row:=old; else v_row:=new; end if;
 v_payload:=jsonb_build_object('entity','reservations','operation',tg_op,'id',v_row.id,'status',v_row.status);
 perform realtime.send(v_payload,'change','buyer-reservations:'||v_row.buyer_id::text,true);
 perform realtime.send(v_payload,'change','merchant-reservations:'||v_row.business_id::text,true);
 return null;
exception when others then
 raise warning 'CercaYa: fallo al emitir cambio de reserva; SQLSTATE %',sqlstate;
 return null;
end;
$$;
revoke all on function private.emit_reservation_change() from public,anon,authenticated;
drop trigger if exists cercaya_reservations_realtime on public.reservations;
create trigger cercaya_reservations_realtime after insert or update or delete on public.reservations
 for each row execute function private.emit_reservation_change();
commit;

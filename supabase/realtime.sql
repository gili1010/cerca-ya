-- Ejecutar MANUALMENTE sobre el proyecto existente. No requiere repetir otras migraciones.
begin;

-- Consultar el catálogo local al ejecutar: no agregar dos veces las mismas tablas.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requests') then
    alter publication supabase_realtime add table public.requests;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'offers') then
    alter publication supabase_realtime add table public.offers;
  end if;
end;
$$;

-- Radar no tiene SELECT sobre requests. NO abrir esa RLS para habilitar eventos.
-- Canales privados, sin filas completas, autorizados con los mismos propietarios.
create or replace function private.can_receive_cercaya_topic(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    p_topic = 'buyer-requests:' || auth.uid()::text
    or exists (select 1 from public.requests r
      where p_topic = 'offers:' || r.id::text and r.buyer_id = auth.uid())
    or exists (select 1 from public.offers o join public.businesses b on b.id = o.business_id
      where p_topic = 'merchant-offer:' || o.id::text and b.owner_id = auth.uid())
    or exists (select 1 from public.businesses b
      where p_topic = 'merchant-radar:' || b.id::text and b.owner_id = auth.uid() and b.active)
  );
$$;
revoke all on function private.can_receive_cercaya_topic(text) from public, anon, authenticated;
grant execute on function private.can_receive_cercaya_topic(text) to authenticated;

-- Supabase ya habilita RLS en esta tabla administrada. El rol postgres puede
-- gestionar sus policies, pero no ejecutar ALTER TABLE sobre realtime.messages.
-- No cambiar propietario ni volver a habilitar RLS aquí.
drop policy if exists cercaya_receive_changes on realtime.messages;
create policy cercaya_receive_changes on realtime.messages for select to authenticated
  using (extension = 'broadcast' and private.can_receive_cercaya_topic((select realtime.topic())));
-- Una policy permisiva anterior no debe abrir nuestros namespaces privados.
drop policy if exists cercaya_topic_boundary on realtime.messages;
create policy cercaya_topic_boundary on realtime.messages as restrictive for select to public
  using (topic !~ '^(buyer-requests|offers|merchant-offer|merchant-radar):'
    or (extension = 'broadcast' and private.can_receive_cercaya_topic(topic)));
-- Sólo los triggers publican; ningún cliente puede falsificar avisos de CercaYa.
drop policy if exists cercaya_no_client_changes on realtime.messages;
create policy cercaya_no_client_changes on realtime.messages as restrictive for insert to public
  with check (topic !~ '^(buyer-requests|offers|merchant-offer|merchant-radar):');

create or replace function private.emit_cercaya_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_request uuid;
  v_buyer uuid;
  v_business uuid;
  v_payload jsonb;
  v_radar boolean := false;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  if tg_table_name = 'requests' then
    v_request := (v_row->>'id')::uuid;
    v_buyer := (v_row->>'buyer_id')::uuid;
    v_payload := jsonb_build_object('entity','requests','operation',tg_op,
      'id',v_request,'request_id',v_request,'status',v_row->>'status');
    v_radar := v_row->>'status' = 'OPEN';
    if tg_op = 'UPDATE' then v_radar := v_radar or old.status = 'OPEN'; end if;
    perform realtime.send(v_payload, 'change', 'buyer-requests:' || v_buyer::text, true);
    -- El detalle puede estar abierto también en otro dispositivo del comprador.
    perform realtime.send(v_payload, 'change', 'offers:' || v_request::text, true);
  elsif tg_table_name = 'offers' then
    v_request := (v_row->>'request_id')::uuid;
    select r.buyer_id, (r.status = 'OPEN' and r.expires_at > now()) into v_buyer, v_radar
      from public.requests r where r.id = v_request;
    v_payload := jsonb_build_object('entity','offers','operation',tg_op,
      'id',v_row->>'id','request_id',v_request,'status',v_row->>'status');
    if v_buyer is not null then
      perform realtime.send(v_payload, 'change', 'buyer-requests:' || v_buyer::text, true);
      perform realtime.send(v_payload, 'change', 'offers:' || v_request::text, true);
    end if;
    perform realtime.send(v_payload, 'change', 'merchant-offer:' || (v_row->>'id'), true);
  end if;
  if v_radar then
    -- Todas las oportunidades OPEN son visibles por read_radar; cada comercio tiene
    -- su canal. No transmitir IDs de ofertas ajenas, comprador, título ni ubicación.
    for v_business in select b.id from public.businesses b where b.active and b.owner_id is not null loop
      perform realtime.send(jsonb_build_object('entity','radar','operation','REFRESH'),
        'change', 'merchant-radar:' || v_business::text, true);
    end loop;
  end if;
  return null; -- AFTER trigger, no modifica la fila.
exception when others then
  -- Realtime es una mejora: un fallo de emisión no debe impedir guardar el pedido/oferta.
  raise warning 'CercaYa Realtime: no se pudo emitir un aviso; SQLSTATE %', sqlstate;
  return null;
end;
$$;
revoke all on function private.emit_cercaya_change() from public, anon, authenticated;
drop trigger if exists cercaya_requests_realtime on public.requests;
create trigger cercaya_requests_realtime after insert or update or delete on public.requests
  for each row execute function private.emit_cercaya_change();
drop trigger if exists cercaya_offers_realtime on public.offers;
create trigger cercaya_offers_realtime after insert or update or delete on public.offers
  for each row execute function private.emit_cercaya_change();
-- No REPLICA IDENTITY FULL, nuevas tablas de negocio, cambios de grants/RLS de
-- requests/offers ni triggers/suscripciones en productos, stock o reservas.
commit;

-- Resultado informativo para quien ejecuta este archivo (no consulta remota del agente).
select schemaname, tablename from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename in ('requests','offers');

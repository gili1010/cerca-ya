-- Delta de soporte. Ejecutar manualmente; no modifica pedidos ni Auth.
begin;
create schema if not exists private;
create table if not exists private.contact_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 120),
  preferred_contact text not null check (preferred_contact in ('PHONE','EMAIL')),
  phone text check (phone is null or (length(phone) <= 40 and phone ~ '^[+0-9() .-]+$' and length(regexp_replace(phone,'[^0-9]','','g')) between 8 and 15)),
  email text check (email is null or (length(email) <= 254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  reason text not null check (reason in ('Problema con un pedido','Problema con mi cuenta','Problema con mi comercio','Recuperar acceso','Privacidad / mis datos','Reportar un problema','Otro')),
  order_reference text check (order_reference is null or length(order_reference) <= 80),
  message text not null check (length(btrim(message)) between 1 and 2000),
  status text not null default 'OPEN' check (status in ('OPEN','RESOLVED')),
  created_at timestamptz not null default now(),
  check ((preferred_contact='PHONE' and phone is not null) or (preferred_contact='EMAIL' and email is not null))
);
alter table private.contact_requests enable row level security;
revoke all on private.contact_requests from public,anon,authenticated;
create index if not exists contact_requests_created_idx on private.contact_requests(created_at desc);
create index if not exists contact_requests_email_idx on private.contact_requests(lower(email),created_at desc);
create index if not exists contact_requests_phone_idx on private.contact_requests((regexp_replace(phone,'[^0-9]','','g')),created_at desc);
create index if not exists contact_requests_user_idx on private.contact_requests(user_id,created_at desc) where user_id is not null;

-- Sólo el servidor con service_role invoca esta función. El navegador no puede
-- insertar ni leer consultas. p_user_id se obtiene de getUser(), no del formulario.
create or replace function public.create_contact_request(p_input jsonb,p_user_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid;
  v_name text := btrim(p_input->>'name');
  v_method text := p_input->>'preferred_contact';
  v_phone text := nullif(btrim(p_input->>'phone'),'');
  v_email text := nullif(lower(btrim(p_input->>'email')),'');
  v_phone_key text;
begin
  if jsonb_typeof(p_input) <> 'object' or v_name is null or v_method is null
    or p_input->>'reason' is null or p_input->>'message' is null then
    raise exception 'CONTACT_INVALID' using errcode='22023';
  end if;
  v_phone_key := regexp_replace(v_phone,'[^0-9]','','g');
  -- Bloqueos compartidos por contacto/usuario evitan envíos concurrentes que
  -- salteen el límite. Cinco consultas por hora, sin infraestructura adicional.
  if v_email is not null then perform pg_advisory_xact_lock(hashtextextended('contact-email:'||v_email,0)); end if;
  if v_phone_key is not null then perform pg_advisory_xact_lock(hashtextextended('contact-phone:'||v_phone_key,0)); end if;
  if p_user_id is not null then perform pg_advisory_xact_lock(hashtextextended('contact-user:'||p_user_id::text,0)); end if;
  if (select count(*) from private.contact_requests where created_at > now()-interval '1 hour'
      and ((v_email is not null and lower(email)=v_email)
        or (v_phone_key is not null and regexp_replace(phone,'[^0-9]','','g')=v_phone_key)
        or (p_user_id is not null and user_id=p_user_id))) >= 5 then
    raise exception 'CONTACT_RATE_LIMIT' using errcode='P0001';
  end if;
  insert into private.contact_requests(user_id,name,preferred_contact,phone,email,reason,order_reference,message)
    values(p_user_id,v_name,v_method,v_phone,v_email,p_input->>'reason',nullif(btrim(p_input->>'order_reference'),''),btrim(p_input->>'message')) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_contact_request(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.create_contact_request(jsonb,uuid) to service_role;
notify pgrst,'reload schema';
commit;

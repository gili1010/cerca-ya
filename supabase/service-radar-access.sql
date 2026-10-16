-- Radar de servicios 2/3. RPC privadas por cuenta, sin acceso anónimo ni DML directo.
begin;
create function private.service_radar_actor() returns void
language plpgsql security definer set search_path='' as $$
declare v_writes integer;
begin
 perform private.require_active_marketplace_user();
 perform pg_advisory_xact_lock(hashtextextended('service-radar:'||auth.uid()::text,0));
 insert into private.service_radar_write_limits(user_id,window_start,writes) values(auth.uid(),clock_timestamp(),1)
 on conflict(user_id) do update set
   writes=case when service_radar_write_limits.window_start<=clock_timestamp()-interval '1 minute' then 1 else service_radar_write_limits.writes+1 end,
   window_start=case when service_radar_write_limits.window_start<=clock_timestamp()-interval '1 minute' then clock_timestamp() else service_radar_write_limits.window_start end
 returning writes into v_writes;
 if v_writes>30 then raise exception 'SERVICE_RADAR_LIMIT' using errcode='22023'; end if;
end;
$$;
create function private.service_radar_page(p_offset integer,p_limit integer) returns void
language plpgsql immutable set search_path='' as $$
begin
 if p_offset is null or p_offset<0 or p_limit is null or p_limit not between 1 and 50 then
   raise exception 'SERVICE_RADAR_FILTER_INVALID' using errcode='22023'; end if;
end;
$$;
create function private.service_radar_matches(p_request_id uuid,p_provider_id uuid,p_listing_id uuid default null) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.service_requests r join public.service_providers p on p.id=p_provider_id
   where r.id=p_request_id and r.status='OPEN' and r.expires_at>statement_timestamp() and r.admin_blocked_at is null
     and r.requester_id<>p.owner_id and not exists(select 1 from private.user_suspensions s where s.user_id=r.requester_id)
     and private.service_provider_enabled(p.id)
     and exists(select 1 from public.service_areas a where a.provider_id=p.id and a.province_code=r.province_code and a.city_normalized=r.city_normalized)
     and exists(select 1 from public.service_listings l where l.provider_id=p.id and l.category_id=r.category_id
       and (p_listing_id is null or l.id=p_listing_id) and l.accepting_inquiries and private.service_listing_is_public(l.id)));
$$;
create function private.service_radar_request_document(p_id uuid,p_own boolean default false) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'category_id',r.category_id,'category_name',c.name,'title',r.title,'description',r.description,
   'city',r.city,'province_code',r.province_code,'country_code',r.country_code,
   'status',case when r.status='OPEN' and r.expires_at<=statement_timestamp() then 'EXPIRED' else r.status end,
   'revision',r.revision,'created_at',r.created_at,'updated_at',r.updated_at,'expires_at',r.expires_at,
   'selected_offer_id',case when p_own then r.selected_offer_id end,
   'available',r.status='OPEN' and r.expires_at>statement_timestamp() and r.admin_blocked_at is null
     and c.active and exists(select 1 from public.service_categories root where root.id=c.parent_id and root.active)
     and not exists(select 1 from private.user_suspensions s where s.user_id=r.requester_id))
 from public.service_requests r join public.service_categories c on c.id=r.category_id where r.id=p_id;
$$;
create function private.service_radar_offer_document(p_id uuid,p_buyer boolean default false) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',o.id,'request_id',o.request_id,'provider_id',o.provider_id,'service_listing_id',o.service_listing_id,
   'message',o.message,'pricing_mode',o.pricing_mode,'proposed_price',o.proposed_price,'currency',o.currency,'status',o.status,
   'revision',o.revision,'created_at',o.created_at,'updated_at',o.updated_at,'provider_name',p.display_name,
   'provider_available',private.service_provider_is_public(p.id),
   'available',o.admin_blocked_at is null and r.admin_blocked_at is null and private.service_listing_is_public(o.service_listing_id)
     and l.accepting_inquiries and exists(select 1 from public.service_areas a where a.provider_id=p.id and a.province_code=r.province_code and a.city_normalized=r.city_normalized),
   'contact_whatsapp',case when p_buyer and o.status='ACCEPTED' and o.admin_blocked_at is null and r.admin_blocked_at is null
     and private.service_listing_is_public(o.service_listing_id) and l.accepting_inquiries
     and exists(select 1 from public.service_areas a where a.provider_id=p.id and a.province_code=r.province_code and a.city_normalized=r.city_normalized)
     then private.service_provider_document(p.id,false)->>'contact_whatsapp' end,
   'request',private.service_radar_request_document(r.id,p_buyer))
 from public.service_request_offers o join public.service_requests r on r.id=o.request_id
 join public.service_providers p on p.id=o.provider_id join public.service_listings l on l.id=o.service_listing_id where o.id=p_id;
$$;

create function public.save_my_service_request(p_request_id uuid,p_input jsonb,p_expected_revision bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_row public.service_requests%rowtype; v_category uuid;
begin
 perform private.service_radar_actor();
 if p_request_id is null then raise exception 'SERVICE_RADAR_INVALID' using errcode='22023'; end if;
 select * into v_row from public.service_requests where id=p_request_id for update;
 if found then
   if v_row.requester_id<>auth.uid() then raise exception 'SERVICE_RADAR_NOT_OWNED' using errcode='42501'; end if;
   if p_expected_revision is null then return p_request_id; end if; -- reconcilia UUID, no vuelve a crear
   if v_row.revision<>p_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
   if v_row.status<>'OPEN' or v_row.expires_at<=clock_timestamp() or v_row.admin_blocked_at is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
   if exists(select 1 from public.service_request_offers where request_id=p_request_id) then raise exception 'SERVICE_RADAR_HAS_OFFERS' using errcode='22023'; end if;
 elsif p_expected_revision is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023';
 else
   if (select count(*) from public.service_requests where requester_id=auth.uid() and status='OPEN' and expires_at>clock_timestamp())>=10
     or (select count(*) from public.service_requests where requester_id=auth.uid() and created_at>clock_timestamp()-interval '24 hours')>=20 then
     raise exception 'SERVICE_RADAR_LIMIT' using errcode='22023'; end if;
 end if;
 perform private.service_input(p_input,'{"title":"string","description":"string","category_id":"string","city":"string","province_code":"string"}'::jsonb,
   array['title','description','category_id','city','province_code']);
 v_category:=private.service_uuid(p_input->>'category_id');
 perform private.service_place(p_input->>'city',p_input->>'province_code');
 perform c.id from public.service_categories c join public.service_categories root on root.id=c.parent_id
   where c.id=v_category and c.active and root.active for share of c,root;
 if not found then raise exception 'SERVICE_RADAR_CATEGORY_INVALID' using errcode='22023'; end if;
 if length(btrim(p_input->>'title')) not between 8 and 120 or length(btrim(p_input->>'description')) not between 20 and 2000 then
   raise exception 'SERVICE_RADAR_INVALID' using errcode='22023'; end if;
 if v_row.id is null then
   if exists(select 1 from public.service_requests r where r.requester_id=auth.uid() and r.status='OPEN' and r.expires_at>clock_timestamp()
     and r.category_id=v_category and r.province_code=p_input->>'province_code'
     and r.city_normalized=private.normalize_search_query(p_input->>'city')
     and private.normalize_search_query(r.title)=private.normalize_search_query(p_input->>'title')
     and private.normalize_search_query(r.description)=private.normalize_search_query(p_input->>'description')) then
     raise exception 'SERVICE_RADAR_DUPLICATE_REQUEST' using errcode='23505'; end if;
   insert into public.service_requests(id,requester_id,category_id,title,description,city,province_code)
     values(p_request_id,auth.uid(),v_category,btrim(p_input->>'title'),btrim(p_input->>'description'),btrim(p_input->>'city'),p_input->>'province_code');
 else
   update public.service_requests set category_id=v_category,title=btrim(p_input->>'title'),description=btrim(p_input->>'description'),
     city=btrim(p_input->>'city'),province_code=p_input->>'province_code' where id=p_request_id;
 end if;
 return p_request_id;
end;
$$;

create function public.read_my_service_requests(p_request_id uuid default null,p_offset integer default 0,p_limit integer default 24) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.require_active_marketplace_user(); perform private.service_radar_page(p_offset,p_limit);
 with scoped as materialized(select id,created_at from public.service_requests where requester_id=auth.uid() and (p_request_id is null or id=p_request_id)),
 page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_radar_request_document(id,true) order by created_at desc,id desc) from page),'[]'::jsonb),
   'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 return v_result;
end;
$$;
create function public.read_service_radar(p_request_id uuid default null,p_category_id uuid default null,p_offset integer default 0,p_limit integer default 24) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_provider uuid; v_result jsonb;
begin
 perform private.require_active_marketplace_user(); perform private.service_radar_page(p_offset,p_limit);
 select id into v_provider from public.service_providers where owner_id=auth.uid();
 if v_provider is null or not private.service_provider_enabled(v_provider) then raise exception 'SERVICE_RADAR_PROVIDER_UNAVAILABLE' using errcode='42501'; end if;
 with eligible_categories as materialized(select distinct l.category_id from public.service_listings l
   where l.provider_id=v_provider and l.accepting_inquiries and private.service_listing_is_public(l.id)),
 coverage as materialized(select distinct a.province_code,a.city_normalized from public.service_areas a where a.provider_id=v_provider),
 scoped as materialized(select r.id,r.created_at from public.service_requests r
   join eligible_categories c on c.category_id=r.category_id
   join coverage a on a.province_code=r.province_code and a.city_normalized=r.city_normalized
   where r.status='OPEN' and r.admin_blocked_at is null and r.expires_at>statement_timestamp()
     and (p_request_id is null or r.id=p_request_id) and (p_category_id is null or r.category_id=p_category_id)
     and r.requester_id<>auth.uid() and not exists(select 1 from private.user_suspensions s where s.user_id=r.requester_id)),
 page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_radar_request_document(id,false)||jsonb_build_object(
   'my_offer_id',(select o.id from public.service_request_offers o where o.request_id=page.id and o.provider_id=v_provider)) order by created_at desc,id desc) from page),'[]'::jsonb),
   'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 return v_result;
end;
$$;

-- Orden de bloqueos: actor -> auth.users participantes -> solicitud -> prestador -> servicio/categorías.
-- La suspensión existente bloquea auth.users; las mutaciones de perfil/cobertura bloquean al prestador.
create function private.lock_service_radar_participants(p_request_id uuid,p_provider_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform u.id from auth.users u where u.id in (
   select requester_id from public.service_requests where id=p_request_id
   union select owner_id from public.service_providers where id=p_provider_id) order by u.id for share;
end;
$$;
create function private.lock_service_radar_eligibility(p_request_id uuid,p_provider_id uuid,p_listing_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform id from public.service_providers where id=p_provider_id for update;
 perform id from public.service_listings where id=p_listing_id and provider_id=p_provider_id for share;
 perform c.id from public.service_categories c where c.id in (
   select category_id from public.service_listings where id=p_listing_id
   union select parent_id from public.service_categories where id=(select category_id from public.service_listings where id=p_listing_id)) order by c.id for share;
 if not private.service_radar_matches(p_request_id,p_provider_id,p_listing_id) then
   raise exception 'SERVICE_RADAR_NOT_ELIGIBLE' using errcode='42501'; end if;
end;
$$;
create function public.save_my_service_request_offer(p_offer_id uuid,p_request_id uuid,p_service_listing_id uuid,p_input jsonb,p_expected_revision bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_provider uuid; v_request public.service_requests%rowtype; v_offer public.service_request_offers%rowtype; v_price numeric; v_mode text;
begin
 perform private.service_radar_actor();
 if p_offer_id is null then raise exception 'SERVICE_RADAR_INVALID' using errcode='22023'; end if;
 select id into v_provider from public.service_providers where owner_id=auth.uid();
 if v_provider is null then raise exception 'SERVICE_RADAR_PROVIDER_UNAVAILABLE' using errcode='42501'; end if;
 perform private.lock_service_radar_participants(p_request_id,v_provider);
 select * into v_request from public.service_requests where id=p_request_id for update;
 if not found then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 select * into v_offer from public.service_request_offers where request_id=p_request_id and provider_id=v_provider for update;
 if found then
   if v_offer.id<>p_offer_id or v_offer.service_listing_id is distinct from p_service_listing_id then raise exception 'SERVICE_RADAR_DUPLICATE_OFFER' using errcode='23505'; end if;
   if p_expected_revision is null then return v_offer.id; end if;
   if v_offer.revision<>p_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
   if v_offer.status<>'PENDING' or v_offer.admin_blocked_at is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 elsif p_expected_revision is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023';
 else
   if (select count(*) from public.service_request_offers where provider_id=v_provider and created_at>clock_timestamp()-interval '24 hours')>=50 then
     raise exception 'SERVICE_RADAR_LIMIT' using errcode='22023'; end if;
 end if;
 perform private.lock_service_radar_eligibility(p_request_id,v_provider,p_service_listing_id);
 -- Revalidación de reloj después de esperar bloqueos.
 if v_request.expires_at<=clock_timestamp() then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 perform private.service_input(p_input,'{"message":"string","pricing_mode":"string","proposed_price":"number|null"}'::jsonb,array['message','pricing_mode','proposed_price']);
 v_mode:=p_input->>'pricing_mode'; v_price:=(p_input->>'proposed_price')::numeric;
 if length(btrim(p_input->>'message')) not between 10 and 1500 or v_mode not in ('FIXED','FROM','QUOTE')
   or (v_mode='QUOTE' and v_price is not null) or (v_mode<>'QUOTE' and (v_price is null or v_price<=0 or v_price>9999999999.99 or v_price<>round(v_price,2))) then
   raise exception 'SERVICE_RADAR_INVALID' using errcode='22023'; end if;
 if v_offer.id is null then
   insert into public.service_request_offers(id,request_id,provider_id,service_listing_id,message,pricing_mode,proposed_price)
     values(p_offer_id,p_request_id,v_provider,p_service_listing_id,btrim(p_input->>'message'),v_mode,v_price);
 else update public.service_request_offers set message=btrim(p_input->>'message'),pricing_mode=v_mode,proposed_price=v_price where id=p_offer_id;
 end if;
 return p_offer_id;
end;
$$;

create function public.read_service_request_offers(p_seller boolean default false,p_request_id uuid default null,p_offer_id uuid default null,p_offset integer default 0,p_limit integer default 24) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
 perform private.require_active_marketplace_user(); perform private.service_radar_page(p_offset,p_limit);
 if p_seller is null then raise exception 'SERVICE_RADAR_FILTER_INVALID' using errcode='22023'; end if;
 with scoped as materialized(select o.id,o.created_at from public.service_request_offers o
   join public.service_requests r on r.id=o.request_id join public.service_providers p on p.id=o.provider_id
   where (case when p_seller then p.owner_id=auth.uid() else r.requester_id=auth.uid() end)
     and (p_request_id is null or o.request_id=p_request_id) and (p_offer_id is null or o.id=p_offer_id)),
 page as(select * from scoped order by created_at desc,id desc offset p_offset limit p_limit)
 select jsonb_build_object('items',coalesce((select jsonb_agg(private.service_radar_offer_document(id,not p_seller) order by created_at desc,id desc) from page),'[]'::jsonb),
 'total',(select count(*) from scoped),'offset',p_offset,'limit',p_limit) into v_result;
 return v_result;
end;
$$;
create function public.manage_my_service_request(p_request_id uuid,p_action text,p_expected_revision bigint) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_row public.service_requests%rowtype;
begin
 perform private.service_radar_actor();
 select * into v_row from public.service_requests where id=p_request_id and requester_id=auth.uid() for update;
 if not found then raise exception 'SERVICE_RADAR_NOT_OWNED' using errcode='42501'; end if;
 if p_expected_revision is null or v_row.revision<>p_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
 if p_action is null or p_action not in ('cancel','close','expire') then raise exception 'SERVICE_RADAR_INVALID' using errcode='22023'; end if;
 if v_row.status<>'OPEN' or v_row.admin_blocked_at is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 if (p_action='expire')<>(v_row.expires_at<=clock_timestamp()) then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 update public.service_requests set status=case p_action when 'cancel' then 'CANCELLED' when 'close' then 'CLOSED' else 'EXPIRED' end where id=p_request_id;
 update public.service_request_offers set status='REJECTED' where request_id=p_request_id and status='PENDING';
 return p_request_id;
end;
$$;
create function public.manage_my_service_request_offer(p_offer_id uuid,p_action text,p_expected_revision bigint,p_request_expected_revision bigint default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_offer public.service_request_offers%rowtype; v_request public.service_requests%rowtype; v_owner uuid;
begin
 perform private.service_radar_actor();
 select * into v_offer from public.service_request_offers where id=p_offer_id;
 if not found then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 perform private.lock_service_radar_participants(v_offer.request_id,v_offer.provider_id);
 select * into v_request from public.service_requests where id=v_offer.request_id for update;
 select * into v_offer from public.service_request_offers where id=p_offer_id for update;
 select owner_id into v_owner from public.service_providers where id=v_offer.provider_id;
 if p_action is null or p_action not in ('accept','reject','withdraw') then raise exception 'SERVICE_RADAR_INVALID' using errcode='22023'; end if;
 if (p_action='withdraw' and v_owner<>auth.uid()) or (p_action<>'withdraw' and v_request.requester_id<>auth.uid()) then
   raise exception 'SERVICE_RADAR_NOT_OWNED' using errcode='42501'; end if;
 if p_expected_revision is null or v_offer.revision<>p_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
 if v_offer.status<>'PENDING' then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 -- Retirar está permitido aun si dejó de ser elegible; nunca permite editar o aceptar.
 if p_action='withdraw' then update public.service_request_offers set status='WITHDRAWN' where id=p_offer_id; return p_offer_id; end if;
 if p_request_expected_revision is null or v_request.revision<>p_request_expected_revision then raise exception 'SERVICE_RADAR_CHANGED' using errcode='40001'; end if;
 if v_request.status<>'OPEN' or v_request.expires_at<=clock_timestamp() or v_request.admin_blocked_at is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
 if p_action='accept' then
   if v_offer.admin_blocked_at is not null then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
   perform private.lock_service_radar_eligibility(v_request.id,v_offer.provider_id,v_offer.service_listing_id);
   if v_request.expires_at<=clock_timestamp() then raise exception 'SERVICE_RADAR_UNAVAILABLE' using errcode='22023'; end if;
   update public.service_request_offers set status='ACCEPTED' where id=p_offer_id;
   update public.service_requests set status='CLOSED',selected_offer_id=p_offer_id where id=v_request.id;
   update public.service_request_offers set status='REJECTED' where request_id=v_request.id and id<>p_offer_id and status='PENDING';
 else update public.service_request_offers set status='REJECTED' where id=p_offer_id;
 end if;
 return p_offer_id;
end;
$$;

revoke all on function private.service_radar_actor(),private.service_radar_page(integer,integer),
 private.service_radar_matches(uuid,uuid,uuid),private.service_radar_request_document(uuid,boolean),private.service_radar_offer_document(uuid,boolean),
 private.lock_service_radar_participants(uuid,uuid),private.lock_service_radar_eligibility(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.save_my_service_request(uuid,jsonb,bigint),public.read_my_service_requests(uuid,integer,integer),
 public.read_service_radar(uuid,uuid,integer,integer),public.save_my_service_request_offer(uuid,uuid,uuid,jsonb,bigint),
 public.read_service_request_offers(boolean,uuid,uuid,integer,integer),public.manage_my_service_request(uuid,text,bigint),
 public.manage_my_service_request_offer(uuid,text,bigint,bigint) from public,anon,authenticated;
grant execute on function public.save_my_service_request(uuid,jsonb,bigint),public.read_my_service_requests(uuid,integer,integer),
 public.read_service_radar(uuid,uuid,integer,integer),public.save_my_service_request_offer(uuid,uuid,uuid,jsonb,bigint),
 public.read_service_request_offers(boolean,uuid,uuid,integer,integer),public.manage_my_service_request(uuid,text,bigint),
 public.manage_my_service_request_offer(uuid,text,bigint,bigint) to authenticated;
commit;

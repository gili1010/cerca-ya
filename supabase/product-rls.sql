-- Run manually AFTER schema.sql and business-rls.sql. Never rerun the seed here.
-- Existing policies already provide public active-product reads (also requiring
-- an active business), owner reads including inactive products, and owner-only
-- inserts/updates via private.owns_business. Preserve those policies.
begin;

alter table public.products enable row level security;
revoke delete on public.products from public, anon, authenticated;
-- schema.sql grants UPDATE by column, deliberately excluding business_id/id.
revoke update (business_id) on public.products from public, anon, authenticated;

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
begin
  if auth.uid() is null then raise exception 'product_auth_required' using errcode = '42501'; end if;
  select id into v_business_id from public.businesses where owner_id = auth.uid();
  if v_business_id is null then raise exception 'product_business_required' using errcode = '42501'; end if;

  -- No business_id parameter: ownership always comes from the authenticated user.
  if jsonb_typeof(p_input) is distinct from 'object' or
    (p_input - array['name','description','category_id','brand','model','sku','price','stock_quantity','pickup_enabled','delivery_enabled','active']) <> '{}'::jsonb then
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
  if jsonb_typeof(p_input -> 'price') is distinct from 'number' or
    jsonb_typeof(p_input -> 'stock_quantity') is distinct from 'number' then
    raise exception 'product_invalid_numbers' using errcode = '22023';
  end if;
  v_name := btrim(p_input ->> 'name');
  v_price := (p_input ->> 'price')::numeric;
  v_stock := (p_input ->> 'stock_quantity')::numeric;
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
  v_status := case when v_stock > 0 then 'IN_STOCK'::public.stock_status else 'OUT_OF_STOCK'::public.stock_status end;

  if p_product_id is null then
    insert into public.products (business_id, category_id, name, description, brand, model, sku,
      price, stock_quantity, stock_status, stock_confirmed_at, pickup_enabled, delivery_enabled, active)
    values (v_business_id, v_category_id, v_name, btrim(coalesce(p_input ->> 'description','')),
      nullif(btrim(p_input ->> 'brand'),''), nullif(btrim(p_input ->> 'model'),''), nullif(btrim(p_input ->> 'sku'),''),
      v_price, v_stock::integer, v_status, now(), (p_input ->> 'pickup_enabled')::boolean,
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
      stock_confirmed_at = case when v_old.stock_quantity is distinct from v_stock::integer then now() else v_old.stock_confirmed_at end,
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
    update public.products set stock_confirmed_at = now()
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

commit;

-- Fictional development catalog. Run manually AFTER schema.sql in a new project.
-- No auth.users, fake profiles, passwords or personal coordinates are inserted.
-- Ownerless businesses are readable but cannot be claimed by an API client.
begin;

insert into public.categories (id, name, slug, parent_id, icon) values
  ('10000000-0000-4000-8000-000000000001', 'Ferretería', 'ferreteria', null, 'Wrench'),
  ('10000000-0000-4000-8000-000000000005', 'Tecnología', 'tecnologia', null, 'Smartphone'),
  ('10000000-0000-4000-8000-000000000006', 'Automotor', 'automotor', null, 'Car'),
  ('10000000-0000-4000-8000-000000000007', 'Hogar', 'hogar', null, 'House'),
  ('10000000-0000-4000-8000-000000000008', 'Mascotas', 'mascotas', null, 'PawPrint')
on conflict (id) do nothing;

insert into public.categories (id, name, slug, parent_id, icon) values
  ('10000000-0000-4000-8000-000000000002', 'Electricidad', 'electricidad', '10000000-0000-4000-8000-000000000001', 'Zap'),
  ('10000000-0000-4000-8000-000000000003', 'Herramientas', 'herramientas', '10000000-0000-4000-8000-000000000001', 'Hammer'),
  ('10000000-0000-4000-8000-000000000004', 'Pintura', 'pintura', '10000000-0000-4000-8000-000000000001', 'Paintbrush')
on conflict (id) do nothing;

insert into public.businesses (id, owner_id, name, slug, description, address, city, pickup_enabled, delivery_enabled, delivery_radius_km, delivery_price, minimum_order, verified, active) values
  ('20000000-0000-4000-8000-000000000001', null, 'Ferretería Norte', 'ferreteria-norte', 'Comercio ficticio de herramientas y materiales.', 'Calle de Prueba 100', 'Ciudad Demo', true, true, 5, 2500, 0, false, true),
  ('20000000-0000-4000-8000-000000000002', null, 'Electro Centro', 'electro-centro', 'Comercio ficticio de materiales eléctricos.', 'Pasaje de Ejemplo 200', 'Ciudad Demo', true, false, 0, 0, 0, false, true),
  ('20000000-0000-4000-8000-000000000003', null, 'Tecnología Sur', 'tecnologia-sur', 'Comercio ficticio de accesorios tecnológicos.', 'Avenida Demo 300', 'Ciudad Demo', true, true, 10, 1800, 0, false, true)
on conflict (id) do nothing;

insert into public.business_categories (business_id, category_id) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003'),
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005')
on conflict (business_id, category_id) do nothing;

insert into public.products (id, business_id, category_id, name, description, brand, model, sku, price, stock_quantity, stock_status, stock_confirmed_at, pickup_enabled, delivery_enabled, active) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Taladro Bosch GSB 550', 'Producto de prueba: taladro percutor de 550 W.', 'Bosch', 'GSB 550', 'DEMO-TAL-001', 84900, 4, 'IN_STOCK', now(), true, true, true),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Térmica bipolar 25A', 'Producto de prueba: interruptor termomagnético bipolar.', 'Schneider', '25A', 'DEMO-TER-001', 12500, 3, 'IN_STOCK', now(), true, false, true),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', 'Cargador Samsung USB-C 25W', 'Producto de prueba: cargador, cable no incluido.', 'Samsung', 'USB-C 25W', 'DEMO-CAR-001', 21900, 5, 'IN_STOCK', now(), true, true, true),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Mecha de 8mm', 'Producto de prueba: mecha para mampostería.', null, '8mm', 'DEMO-MEC-001', 3900, 8, 'IN_STOCK', now(), true, true, true),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'Amoladora', 'Producto de prueba: amoladora angular de 115 mm.', null, '115mm', 'DEMO-AMO-001', 65900, 2, 'LOW_STOCK', now(), true, true, true)
on conflict (id) do nothing;

commit;

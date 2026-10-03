-- Delta: nuevas categorías generales. Ejecutar manualmente en el proyecto existente.
-- Conserva IDs, relaciones y categorías anteriores, incluida Pintura.
-- La lectura pública existente de categories ya permite mostrar estas filas.
begin;

insert into public.categories (name, slug, parent_id, icon) values
  ('Gastronomía', 'gastronomia', null, 'ChefHat'),
  ('Limpieza', 'limpieza', null, 'Sparkles'),
  ('Artesanías', 'artesanias', null, 'Palette')
on conflict (slug) do nothing;

commit;

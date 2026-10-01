# Productos reales del comercio

La foto principal ahora se puede seleccionar, reemplazar y eliminar desde el formulario. Configuración y SQL adicional: [PRODUCT_STORAGE_SETUP.md](PRODUCT_STORAGE_SETUP.md). Las referencias a placeholder más abajo describen la etapa previa de CRUD.

Implementación limitada a `/comercio/productos`, creación, edición, confirmación de stock, desactivación y reactivación. El panel cuenta productos reales con `active = true`, incluidos los que están sin stock. El listado incluye activos e inactivos y pagina de a 24 productos.

La Home, búsqueda y detalle ahora leen los productos reales; ver [PUBLIC_CATALOG_SETUP.md](PUBLIC_CATALOG_SETUP.md). Pedido Abierto, ofertas, reservas y Radar conservan sus operaciones locales. El selector de comercio demo no determina el propietario de los productos reales. No hay Storage ni subida de fotos: el formulario del comercio sigue usando un placeholder.

## SQL que debés ejecutar

1. Abrí el proyecto correcto en Supabase → SQL Editor → New query.
2. Copiá TODO el contenido de `supabase/product-rls.sql` y ejecutalo.
3. Esperá que termine correctamente antes de usar Publicar, Guardar o Confirmar stock.

Prerequisitos: el esquema inicial, Auth/perfiles y `supabase/business-rls.sql` ya deben estar instalados, como en el estado actual del proyecto. No vuelvas a ejecutar `schema.sql`, `seed.sql` ni las migraciones anteriores. Este archivo no inserta ejemplos ni modifica los productos existentes.

El SQL agrega dos funciones con `SECURITY INVOKER` y `search_path` fijo:

- `save_my_product(p_input jsonb, p_product_id uuid default null)`: crea o edita. Resuelve el comercio a partir de `auth.uid()`, valida campos y categoría, aplica una lista cerrada de campos y rechaza un `business_id` dentro del JSON. El propietario no puede cambiarse.
- `manage_my_product(p_product_id uuid, p_action text)`: acepta `confirm_stock`, `deactivate` o `activate`, siempre dentro del comercio de la sesión.

Ambas respetan RLS y sólo pueden ejecutarse como `authenticated`; no usan `service_role`. La restricción existente de un comercio por propietario identifica el negocio de forma unívoca. Se conserva el SKU único por comercio; un SKU vacío se guarda como NULL.

Las políticas existentes de `schema.sql` fueron revisadas y se conservan:

- Público: lee productos activos de comercios activos.
- Propietario: lee también sus productos inactivos, crea y modifica sólo en su comercio.
- El permiso UPDATE por columnas no incluye `business_id`. El SQL adicional revoca explícitamente ese permiso y DELETE. No se ofrece eliminación física.

Crear siempre deja `active = true`, deriva `IN_STOCK` para cantidad positiva y `OUT_OF_STOCK` para cero, y asigna `stock_confirmed_at = now()`.

Editar deriva el estado de stock. Sólo si cambia la cantidad se actualiza la confirmación; cambiar nombre, precio o estado activo conserva su fecha. La confirmación rápida actualiza únicamente `stock_confirmed_at`; el trigger de auditoría ya existente también actualiza `updated_at`. Confirmar cero unidades conserva `OUT_OF_STOCK`, no inventa disponibilidad.

## Prueba manual paso a paso

No se ejecutaron pruebas automáticas, suites, build, lint, typecheck, navegador ni SQL remoto durante esta implementación.

1. Con el servidor local que usás habitualmente, iniciá sesión con una cuenta **A** que ya tenga comercio. Entrá en `/comercio/productos`. Si no hay productos, debe aparecer “Tu comercio todavía no tiene productos.” y “Publicar primer producto”. Una cuenta sin comercio debe ir a `/comercio/crear`; sin sesión, a login.
2. Elegí **Publicar primer producto** o **Publicar producto**. Completá nombre `Taladro de prueba`, descripción, una categoría, marca, modelo y SKU `PRUEBA-001`. Ingresá precio `84900`, stock `3`, retiro y/o envío. Las categorías del comercio aparecen primero; también se pueden elegir otras categorías de Supabase.
3. Publicá una vez. Mientras se guarda debe aparecer **Publicando producto...** y los controles quedan deshabilitados. Debe volver a Mis productos con nombre, precio, categoría, cantidad, estado activo y fecha de confirmación. Si el comercio está activo, aparece en la búsqueda pública; con stock también puede aparecer en Disponible hoy.
4. En Supabase → Table Editor → `products`, filtrá por ese nombre o SKU. Anotá su `id` como **PRODUCTO_A** y su `category_id` como **CATEGORIA**. Verificá `business_id` contra el comercio cuyo `owner_id` es el UUID de A; `stock_quantity = 3`, `stock_status = IN_STOCK`, `active = true`, y `stock_confirmed_at` reciente. Supabase puede mostrar UTC; la web muestra la hora local del navegador.
5. En Mis productos, pulsá **Editar**. Cambiá nombre, descripción, categoría, marca/modelo/SKU, precio y opciones de entrega, manteniendo el stock en 3. Guardá y recargá. Verificá los cambios en la web y Supabase, el mismo `business_id` y la misma `stock_confirmed_at`.
6. Editá nuevamente: cambiá stock a **0** y guardá. Debe quedar `OUT_OF_STOCK`, con confirmación nueva y cantidad 0. Cambialo a **5** y guardá: debe quedar `IN_STOCK`, con otra confirmación nueva.
7. Anotá cantidad, estado de stock y fecha; pulsá **Confirmar stock**. En Supabase la fecha debe avanzar, manteniendo cantidad 5 y estado `IN_STOCK`. La web debe mostrar “Stock confirmado. La cantidad se mantuvo.”. Si querés ver diferencias fácilmente, dejá pasar unos segundos entre acciones.
8. Pulsá **Desactivar producto**. Debe permanecer en el listado como Inactivo, sin borrarse de `products`; `active = false`. La cantidad y confirmación deben mantenerse. Entrá en `/comercio`: la cantidad publicada debe bajar en uno.
9. Volvé a Mis productos y pulsá **Reactivar producto**. Debe quedar Activo, con el mismo ID, stock y confirmación. El contador del panel debe subir en uno al volver al panel. También podés modificar Activo desde el formulario de edición.
10. Intentá publicar con nombre vacío, categoría vacía, precio negativo o stock negativo/fraccionario. La UI debe impedir el envío. Dejar precio vacío no equivale a cero; el valor 0 sí es válido. Un SKU repetido en el mismo comercio debe mostrar un mensaje; vacío se permite.

## Comprobar aislamiento entre dos usuarios

1. Con A, copiá la URL `/comercio/productos/PRODUCTO_A/editar` del producto creado.
2. Cerrá sesión. Iniciá sesión con una cuenta **B**, con correo diferente. Creá su comercio si aún no tiene uno.
3. Entrá en Mis productos: debe mostrar sólo productos de B. Abrí la URL copiada de A: debe indicar “No encontramos ese producto en tu comercio.”, sin cargar el formulario.
4. Para comprobar también la autorización en la base (y no sólo la interfaz), obtené el UUID de B desde Authentication → Users. En SQL Editor reemplazá `UUID_USUARIO_B` y `UUID_PRODUCTO_A` y ejecutá este bloque completo:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_USUARIO_B","role":"authenticated"}', true);

-- Debe devolver CERO filas. RLS debe excluir el producto de A del UPDATE.
update public.products set price = 1
where id = 'UUID_PRODUCTO_A'::uuid
returning id;

rollback;
```

5. Para verificar las funciones que usa la UI, reemplazá además `UUID_CATEGORIA` con una categoría válida de Supabase. Ejecutá este bloque completo con los mismos UUID. Las NOTICE esperadas confirman el rechazo de edición, confirmación, desactivación y reactivación. `rollback` garantiza que esta comprobación manual no persista cambios, incluso si apareciera el mensaje **FALLO**.

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_USUARIO_B","role":"authenticated"}', true);

do $$
declare
  action_name text;
begin
  begin
    perform public.save_my_product(
      jsonb_build_object(
        'name', 'Cambio no autorizado', 'description', '',
        'category_id', 'UUID_CATEGORIA', 'brand', null, 'model', null, 'sku', null,
        'price', 1, 'stock_quantity', 1,
        'pickup_enabled', true, 'delivery_enabled', false, 'active', true
      ), 'UUID_PRODUCTO_A'::uuid
    );
    raise exception 'FALLO: se permitió editar un producto ajeno';
  exception when insufficient_privilege then
    raise notice 'Correcto: edición rechazada (%)', SQLERRM;
  end;
  foreach action_name in array array['confirm_stock', 'deactivate', 'activate'] loop
    begin
      perform public.manage_my_product('UUID_PRODUCTO_A'::uuid, action_name);
      raise exception 'FALLO: se permitió la acción % sobre un producto ajeno', action_name;
    exception when insufficient_privilege then
      raise notice 'Correcto: % rechazada (%)', action_name, SQLERRM;
    end;
  end loop;
end;
$$;

rollback;
```

Si alguna consulta falla inesperadamente, ejecutá `rollback;` antes de continuar. B debe tener su comercio para comprobar el rechazo específico `product_not_owned`, no sólo `product_business_required`. Ejecutar como administrador sin `set local role authenticated` no comprueba RLS de usuario. No necesitás copiar contraseñas, tokens ni claves secretas.

## Archivos creados

- `supabase/product-rls.sql`
- `src/lib/merchant-products/client.ts`
- `src/lib/merchant-products/form.ts`
- `src/components/merchant-products/business-gate.tsx`
- `src/components/merchant-products/product-form.tsx`
- `src/components/merchant-products/product-list.tsx`
- `src/components/merchant-products/stock-confirmation.tsx`
- `src/components/merchant-products/published-products-link.tsx`
- `src/app/comercio/productos/nuevo/page.tsx`
- `src/app/comercio/productos/[id]/editar/page.tsx`
- `PRODUCT_SETUP.md`

## Archivos modificados

- `src/app/comercio/productos/page.tsx`: reemplaza el listado demo de esta ruta por el listado real protegido.
- `src/types/database.ts`: contratos de las nuevas funciones, reutilizando `ProductRow`.
- `src/proxy.ts`: protege todo `/comercio/productos`.
- `src/components/radar/merchant-workspace.tsx`: contador real y acceso a Mis productos en el panel; Radar conserva su implementación local.
- `src/components/requests/request-shell.tsx`: etiqueta Mis productos y navegación activa en sus subrutas.
- `src/components/businesses/my-business.tsx`: acceso a Mis productos y texto de alcance actualizado.
- `src/app/workflows.css`: estilos acotados a las nuevas cards, con una columna en móvil.
- `README.md`: enlace a esta guía y descripción del alcance actual.

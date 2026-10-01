# Foto principal de producto

## Ejecutar manualmente

Abrí Supabase → SQL Editor → New query, pegá **todo** `supabase/product-storage.sql` y ejecutalo una vez. Requiere el esquema y CRUD de productos existentes. No vuelvas a ejecutar `schema.sql`, `seed.sql` ni las migraciones anteriores.

El archivo prepara:

- Bucket público `product-images` con límite de **2 MB por archivo final** y tipos `image/jpeg`, `image/png`, `image/webp`.
- Lectura pública de imágenes. Un bucket público permite ver una URL aunque el producto luego quede inactivo: las fotos no son archivos privados. El catálogo sigue excluyendo productos/comercios inactivos.
- INSERT/UPDATE de objetos sólo para el dueño autenticado del comercio al que pertenece el producto de la ruta.
- DELETE sólo para ese dueño, después de separar el archivo de `product_images`. No se permite borrar un archivo aún referenciado por el producto.
- Función `set_my_product_photo`, con `SECURITY INVOKER`, RLS y permisos de sesión; nunca `service_role`. Verifica dueño, existencia del archivo, producto y URL esperada antes de cambiar la foto. Si otra sesión cambió la foto, rechaza la sustitución con un mensaje amigable.
- Se conserva la restricción existente `UNIQUE(product_id, position)` y las políticas de propietario de `product_images`. Esta interfaz sólo escribe `position = 0`; no crea una galería.

Los nombres de las cuatro políticas de Storage empiezan por `cercaya_product_images_`. El archivo reemplaza sólo esas políticas, no las de otros buckets. Si agregaste por tu cuenta políticas generales de escritura en Storage, revisalas: PostgreSQL combina las políticas permisivas con OR, por lo que una regla previa demasiado amplia podría permitir acceso adicional.

## Comportamiento

En Crear/Editar producto aparece **Foto del producto**, con selección, preview, eliminación y deshacer. Elegir otro archivo reemplaza la selección. **Los cambios se aplican al guardar el producto**, no al seleccionar el archivo ni pulsar Eliminar foto.

Se admiten JPEG/PNG/WebP de hasta **10 MB originales**. El navegador decodifica y vuelve a codificar la imagen usando canvas; no se envía a terceros y no requiere dependencias nuevas. El lado mayor queda como máximo en **1200 px**, sin agrandar fotos pequeñas. Se intenta WebP y se usa JPEG si el navegador no lo soporta. Se prueban calidades moderadas y, si hace falta, dimensiones menores, buscando unos **350 KB o menos**. Fotos pequeñas pueden quedar por debajo de 100 KB; no se aumenta su peso artificialmente. Una imagen difícil puede superar el objetivo sin superar 2 MB. La conversión aplana transparencias sobre blanco.

El archivo se guarda como:

```text
product-images/businessId/productId/uuid-de-la-version.webp
```

El sufijo puede ser `.jpg` si se usó JPEG. La ruta nunca depende del nombre original. El UUID por versión evita colisiones y caché de imágenes anteriores.

PostgreSQL recibe únicamente la URL en `product_images`, con `product_id` y `position = 0`. No se guardan Base64 ni blobs en PostgreSQL, en `products` ni en localStorage. Los blobs y URLs de preview sólo viven en memoria y se liberan al cambiar de selección o salir.

Crear con foto guarda primero el producto y luego sube/asocia la imagen. Si falla la foto, conserva el producto y muestra **“El producto fue creado, pero no pudimos cargar la imagen.”**, junto con el enlace a Editar. Reintentar en ese formulario actualiza el mismo ID, no vuelve a crear un producto.

Reemplazar sube un archivo nuevo, cambia la referencia y elimina el anterior usando la API de Storage. Eliminar foto quita la referencia y después el archivo, de modo que el catálogo vuelva al placeholder. Las URLs manuales de sitios externos no se borran de esos sitios: sólo se quita su referencia. Se eliminan únicamente archivos de este bucket y carpeta del producto.

Si falla el guardado de la referencia, se intenta limpiar el upload que no quedó en uso. Si se pierde una respuesta, se vuelve a leer la referencia antes de decidir qué eliminar. Si falla la limpieza, la pantalla queda abierta con **Reintentar limpieza**. No se informa éxito completo ni se redirige automáticamente en ese caso.

Storage y PostgreSQL no comparten una transacción. Una desconexión o cierre abrupto del navegador puede interrumpir la limpieza; completá el reintento antes de salir. Si cerraste la pantalla, revisá manualmente la carpeta del producto contra la URL de `product_images` para eliminar archivos sin referencia. No se agregó una tarea automática de limpieza ni otro módulo.

El catálogo conserva sus componentes y estilos. Sólo selecciona `position = 0`, para que eliminar la principal vuelva al placeholder aunque hubiera filas manuales antiguas en otras posiciones. Las demás filas no se borran y la estructura queda disponible para una futura galería.

## Prueba manual

No se ejecutaron pruebas automáticas, suites, build, lint, typecheck, navegador, SQL remoto ni uploads reales durante esta implementación.

1. Ejecutá el SQL anterior. En Storage verificá que exista `product-images`, público, con los límites indicados.
2. Iniciá sesión como **A**, dueño de un comercio. Entrá en `/comercio/productos/nuevo`; completá producto, categoría, precio y stock positivo. Seleccioná un JPEG/PNG/WebP menor de 10 MB. Debe mostrar **Procesando imagen...**, luego preview y peso preparado.
3. Pulsá Publicar producto. Durante el upload debe mostrar **Subiendo imagen...**, sin permitir otro envío. Debe volver a Mis productos cuando termine.
4. En Supabase → `products`, copiá el UUID del producto. En Storage → `product-images`, abrí `businessId/productId/`: debe existir el archivo con UUID, extensión WebP o JPG y tamaño reducido.
5. En Table Editor → `product_images`, filtrá por ese producto: debe haber una sola fila principal con `position = 0` y la URL pública del archivo.
6. Con producto y comercio activos y stock positivo, recargá Home, buscalo por nombre y abrí `/producto/UUID`. La misma foto debe verse en Home, búsqueda y detalle, sin cambiar la forma de las cards.
7. Abrí Editar producto. Seleccioná otra imagen: debe verse antes de guardar. Guardá. Comprobá que la fila `position = 0` use la nueva URL, que el archivo nuevo exista y que el anterior haya desaparecido de Storage. No deben crearse dos filas principales.
8. En Editar, pulsá **Eliminar foto** y después **Guardar cambios**. La fila principal y el archivo deben desaparecer. Recargá Home/búsqueda/detalle: debe aparecer el placeholder.
9. Probá un archivo de otro tipo y una foto mayor de 10 MB. Deben mostrar **Formato no compatible.** y **La imagen es demasiado grande.**, respectivamente, sin subir esos archivos. Cancelar la selección no borra la foto existente. Deshacer conserva la foto guardada.
10. Para comprobar el fallo parcial, podés interrumpir manualmente la red cuando aparezca Subiendo imagen. Restaurá la conexión y revisá `products`: el producto debe seguir existiendo. Usá Guardar nuevamente o Abrir Editar producto; no debe duplicarse el registro. Si aparece Reintentar limpieza, completalo antes de salir.

## Comprobar otro usuario

1. Guardá una foto con A. Copiá la URL de edición, el ID de su producto y la ruta del archivo.
2. Cerrá sesión e ingresá con **B**, que tenga su propio comercio. Al abrir la URL de edición de A, debe aparecer Producto no disponible y no debe cargar el formulario.
3. Para comprobar también las políticas, desde SQL Editor reemplazá los tres valores de este bloque: UUID de B, UUID del producto de A y ruta real del archivo de A. Ejecutá el bloque completo. **No borra archivos por SQL:** sólo inspecciona permisos y prueba la función de referencia dentro de una transacción que se revierte.

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_USUARIO_B","role":"authenticated"}', true);

-- Debe devolver false: es la condición usada por INSERT/UPDATE/DELETE de Storage.
select private.owns_product_image_path('BUSINESS_A/PRODUCTO_A/ARCHIVO_A.webp') as puede_modificar_archivo;

-- Debe mostrar una NOTICE indicando que el cambio de referencia fue rechazado.
do $$
begin
  begin
    perform public.set_my_product_photo('UUID_PRODUCTO_A'::uuid, null, null);
    raise exception 'FALLO: se permitió modificar una foto ajena';
  exception when insufficient_privilege then
    raise notice 'Correcto: operación rechazada (%)', SQLERRM;
  end;
end;
$$;

rollback;
```

Si ocurre un error inesperado, ejecutá `rollback;`. También podés comprobar una solicitud Storage con el token de B desde tu cliente habitual: upload/remove sobre la carpeta de A debe quedar rechazado o no afectar ningún objeto. No uses `service_role` ni el administrador del Dashboard para esa prueba, ya que no representan los permisos de B. Una URL pública sí debe ser visible para B o sin sesión; eso es intencional.

## Archivos creados

- `supabase/product-storage.sql`
- `src/lib/merchant-products/compress-photo.ts`
- `src/lib/merchant-products/photo-storage.ts`
- `src/components/merchant-products/product-photo-input.tsx`
- `PRODUCT_STORAGE_SETUP.md`

## Archivos modificados

- `src/types/database.ts`: contrato de la función para actualizar la foto principal.
- `src/lib/merchant-products/client.ts`: lectura de la foto principal en Editar.
- `src/components/merchant-products/product-form.tsx`: selector, estados, guardado, fallos parciales y reintento de limpieza.
- `src/lib/public-catalog.ts`: selecciona la foto principal de posición 0.
- `src/app/workflows.css`: estilos acotados del selector y preview.
- `README.md`, `PRODUCT_SETUP.md` y `PUBLIC_CATALOG_SETUP.md`: referencias a esta etapa.

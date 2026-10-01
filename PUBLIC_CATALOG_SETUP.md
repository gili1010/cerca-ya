# Home, búsqueda y detalle con productos reales

Actualización de cercanía: [LOCATION_SETUP.md](LOCATION_SETUP.md). Home, búsqueda y detalle calculan distancias con ubicación opcional del comprador. Menos de 5 km y Más cerca se habilitan al compartirla. Esta etapa requiere actualizar `business-rls.sql` para guardar la ubicación del comercio; las indicaciones de distancia deshabilitada de esta guía corresponden a la etapa original.

Actualización posterior: el formulario del comercio permite foto principal comprimida en Storage; ver [PRODUCT_STORAGE_SETUP.md](PRODUCT_STORAGE_SETUP.md). El catálogo usa únicamente `position = 0`. Esta función sí requiere su propio `product-storage.sql`; las indicaciones “sin SQL adicional” y “sin subida” de esta guía corresponden a la etapa de lectura del catálogo.

## SQL

**No hay SQL adicional para esta etapa.** Se usan las tablas, relaciones y permisos SELECT/RLS ya existentes en `schema.sql`. El CRUD y sus funciones de `product-rls.sql` deben seguir instalados, tal como en el estado actual del proyecto. No ejecutes de nuevo el esquema ni el seed.

No se ejecutaron pruebas automáticas, suites, build, lint, typecheck, navegador, validaciones visuales ni SQL remoto durante esta implementación.

## Alcance

- Home y búsqueda consultan Supabase directamente con el cliente tipado existente y RLS. No hay reemplazo por mocks ante errores.
- Categorías, nombres de comercios, ciudad y datos de stock provienen de sus relaciones reales. Se conserva `Product` como modelo de presentación con una adaptación desde los tipos de `database.ts`.
- Siempre se exigen `products.active = true` y `businesses.active = true`, incluso si quien consulta es el propietario y RLS le permite leer inactivos.
- Home empieza con Hoy activo y un máximo de 12 productos por página. Hoy exige cantidad positiva y estado distinto de `OUT_OF_STOCK`. Si hay menos de 12 productos, se muestran los disponibles sin completar con ejemplos.
- El orden inicial prioriza stock positivo y después confirmación más reciente, con los NULL al final. Se puede ordenar por precio. Los resultados muestran el total real y tienen paginación.
- Búsqueda por coincidencia parcial `ILIKE` en nombre, marca, modelo o descripción; no distingue mayúsculas. Se escapan comodines y se entrecomillan los valores de PostgREST. No se agrega búsqueda semántica ni normalización de acentos. Por ejemplo, `taladro`, `Taladro` y `TALADRO` son equivalentes, pero `cafe` y `café` no necesariamente.
- La búsqueda sigue en la Home, usando la arquitectura existente. Al empezar a escribir se pasa a búsqueda sin el filtro Hoy inicial, para poder encontrar también productos sin stock. Se puede volver a activar Hoy. Cambiar categoría consulta esa categoría real y permite ver productos sin stock, claramente identificados.
- Filtros: Hoy; Con envío (habilitado en producto y comercio); Retiro (habilitado en ambos); Stock confirmado (fecha no nula, sin inventar un umbral de vigencia).
- Menos de 5 km y orden por cercanía quedan visibles/deshabilitados. No se generan distancias. Las cards muestran la ciudad informada o Ver ubicación. El selector de zona sigue identificado como demo y no limita resultados; la ilustración existente no representa una ubicación real.
- `/producto/[id]` y el alias `/productos/[id]` muestran datos reales, activos y actuales. Los antiguos IDs mock no se usan como alternativa en el detalle público. Un producto ausente/inactivo o de comercio inactivo muestra “Producto no disponible.”.
- WhatsApp usa el número guardado por el comercio y el texto: `Hola, vi [NOMBRE] en CercaYa. ¿Lo tenés disponible?`. Guardá el número con código de país; no se adivina un prefijo. El enlace abre WhatsApp, no envía el mensaje automáticamente.
- La primera URL HTTP(S) válida de `product_images`, ordenada por `position`, se usa como foto. No hay Storage ni subida de archivos. Si falta URL o falla la imagen, se usa el placeholder local. Las URLs se cargan en el navegador, sin habilitar un proxy de imágenes para dominios arbitrarios.
- Los favoritos continúan en memoria durante la visita; sus productos se leen ahora del catálogo real, incluidos los de `/guardados`. No se migró la persistencia de favoritos.

## Reservas y módulos que siguen locales

Pedido Abierto, ofertas y Radar mantienen sus mocks y operaciones actuales. Sus archivos no se borran. Los enlaces antiguos a formularios de reserva demo siguen admitidos.

La reserva de un producto real usa el mismo formulario y motor local. Recibe ID, nombre, precio, cantidad disponible, ID/nombre de comercio, imagen y modalidades de entrega. Antes de crearla se vuelve a leer el producto activo: si desapareció, no se crea; si cambió el precio, se pide recargar.

La reserva y su copia de inventario se guardan en la misma clave local existente. El lector admite UUID de productos y comercios reales, y sigue admitiendo reservas demo anteriores. Confirmar/cancelar desde la simulación sólo cambia ese inventario local, **nunca `products` ni `reservations` en Supabase**. El catálogo público siempre muestra el stock de Supabase, independientemente de la simulación local.

El comprador sigue siendo Cliente Demo en este flujo. El comercio real no recibe la reserva. La pantalla de detalle de la reserva permite la gestión en modo comercio demo existente; el selector/listado de comercios del Radar no se migró. No se implementó logística ni pago.

## Prueba manual exacta

1. Iniciá sesión con una cuenta que tenga comercio. En `/comercio/editar`, informá una ciudad y un WhatsApp válido con código de país. Habilitá retiro y/o envío. Guardá. El comercio debe tener `active = true` en Supabase.
2. Abrí `/comercio/productos/nuevo`. Publicá `Taladro prueba CercaYa`, marca `Bosch`, modelo `GSB 550`, descripción `Herramienta de prueba`, categoría Ferretería (o una categoría existente), precio `84900`, stock `3` y retiro/envío. Dejá el producto activo.
3. En Supabase → Table Editor → `products`, ubicá el registro y copiá su UUID. Verificá comercio, categoría, cantidad 3, `IN_STOCK`, fecha de confirmación reciente y `active = true`.
4. Abrí `/` desde una navegación nueva o recargá. La Home debe mostrar Disponible hoy cerca tuyo. El producto debe aparecer entre los primeros por su confirmación reciente; si hay más de 12 con confirmaciones posteriores, usá la paginación. Su card debe mostrar nombre, precio, comercio, ciudad, categoría y stock reales, sin kilómetros inventados.
5. En el buscador escribí `Taladro prueba CercaYa` y pulsá Buscar. Debe aparecer el producto y la cantidad de resultados. Repetí con `taladro`, `Taladro` y `TALADRO`: los resultados deben ser equivalentes con los mismos filtros.
6. Limpiá filtros y buscá `Bosch`. Debe encontrarlo por su marca o nombre. También podés buscar `GSB 550` o una frase de la descripción. Probá la categoría visual: debe filtrar por la categoría real elegida.
7. Abrí la card. La URL debe ser `/producto/UUID`. Verificá marca, modelo, categoría, descripción, precio, stock, confirmación, modalidades y datos del comercio. Abrí también `/productos/UUID`: debe mostrar el mismo detalle real.
8. Pulsá Hablar por WhatsApp. Debe abrir WhatsApp para el número guardado con el nombre del producto en el mensaje preparado. No hace falta enviar el mensaje para comprobar el enlace. Si no aparece, revisá que el comercio tenga un número válido.
9. Opcional: pulsá Reservar, elegí cantidad y modalidad, confirmá y recargá el detalle de la reserva. Debe conservar ID/nombre/precio/comercio del producto real. No debe aparecer una reserva nueva en Supabase ni variar allí el stock. La reserva está identificada como prueba local.
10. En Mis productos → Editar, cambiá stock a `0` y guardá. Recargá `/` con Hoy activo: no debe aparecer en Disponible hoy. Buscalo sin Hoy: debe aparecer como Sin stock. El detalle debe deshabilitar Reservar.
11. Restablecé stock a `3` y guardá. Recargá Home: debe volver a Disponible hoy con confirmación actualizada.
12. Copiá su URL y desactivá el producto desde Mis productos. Recargá Home y búsqueda: debe desaparecer. Abrí su URL exacta, tanto con la sesión del dueño como sin sesión/en ventana privada: debe decir “Producto no disponible.”. Reactivá para continuar.
13. Si querés comprobar el comercio inactivo, cambiá temporalmente `businesses.active` a `false` desde Table Editor para ese comercio. Recargá el detalle: también debe quedar no disponible. Volvé a ponerlo en `true` al terminar.
14. Buscá un texto único inexistente, por ejemplo `pieza inexistente zzz987654`. Debe mostrar “No encontramos publicaciones cercanas.” y “Pero podemos preguntarle a comercios de tu zona.”. Pulsá “📢 Pedirlo a comercios cercanos”: debe abrir `/pedido/nuevo` con el texto precargado (o pedir login antes). Ese pedido sigue siendo local.
15. Probá Con envío, Retiro y Stock confirmado con productos que cumplan y que no cumplan cada condición. Menos de 5 km y Más cercanos deben estar deshabilitados.
16. Opcional para imágenes: agregá manualmente una fila en `product_images` para ese UUID con una URL HTTP(S) de imagen que puedas usar y `position = 0`. Recargá la Home/detalle. Una URL inválida, rota o inexistente debe mostrar el placeholder. No hay formulario de subida.

## Archivos creados

- `public/product-placeholder.svg`
- `src/lib/public-catalog.ts`
- `src/lib/use-public-catalog.ts`
- `src/lib/public-product-server.ts`
- `src/components/details/product-image.tsx`
- `src/components/details/stock-time.tsx`
- `src/components/details/public-product-detail.tsx`
- `src/app/producto/[id]/loading.tsx`
- `PUBLIC_CATALOG_SETUP.md`

## Archivos modificados

- `src/lib/products.ts`: modelo compartido compatible con datos reales, distancia nullable e imágenes URL; conserva todo el catálogo mock.
- `src/lib/catalog.ts`: compatibilidad del filtro local con distancia nullable.
- `src/components/marketplace.tsx`: consultas reales, categorías, filtros y paginación.
- `src/components/home/catalog.tsx`: total remoto, loading/error, paginación y ausencia de resultados.
- `src/components/home/categories.tsx`: categorías de Supabase, conservando el estilo y los iconos.
- `src/components/home/quick-filters.tsx`: distancia deshabilitada y Retiro sin prometer minutos.
- `src/components/home/product-card.tsx`: reutiliza las cards para datos reales sin consultar inventario local.
- `src/components/home/neighborhood-map.tsx`: etiqueta de la ilustración, sin ubicación real.
- `src/components/home/home-dialogs.tsx`: textos acordes con el catálogo real y los flujos todavía locales.
- `src/app/producto/[id]/page.tsx`: detalle real dinámico y estados de error/no disponible.
- `src/app/productos/[id]/page.tsx`: alias al mismo detalle real.
- `src/app/producto/[id]/reservar/page.tsx`: carga real para UUID y compatibilidad del formulario demo previo.
- `src/types/reservations.ts`: copia del producto y marca de origen real en la reserva local.
- `src/lib/reservation-domain.ts`: creación/lectura local compatible con UUID reales.
- `src/lib/request-store.ts`: consulta de disponibilidad antes de crear la reserva local y stock de referencia opcional.
- `src/components/reservations/reservation-form.tsx`: recibe el producto real y aclara el alcance local.
- `src/components/reservations/reservation-common.tsx`: imágenes URL/placeholder y aviso en el resumen local.
- `src/components/auth/saved-products.tsx`: muestra datos actuales de los productos reales guardados en memoria.
- `src/components/merchant-products/product-list.tsx`: texto sobre visibilidad en Home y búsqueda.
- `src/components/businesses/my-business.tsx`: texto actualizado de alcance.
- `src/app/workflows.css`: estilos acotados para imágenes y datos reales, sin rediseño.
- `README.md` y `PRODUCT_SETUP.md`: documentación actualizada.

# Ubicación del comercio y distancias del catálogo

Implementación limitada a comercio, ubicación local del comprador y catálogo público. No cambia las consultas ni la lógica de Radar, Pedido Abierto, reservas o envíos. El selector compartido del header refleja la ubicación del comprador; sólo el catálogo público la usa para calcular distancias.

## SQL necesario

**Sí: volvé a ejecutar el contenido completo del archivo actualizado `supabase/business-rls.sql`.**

1. En el proyecto Supabase existente, abrí **SQL Editor → New query**.
2. Copiá el contenido completo de `supabase/business-rls.sql`, de `begin;` hasta `commit;`, incluyendo la función.
3. Ejecutá **Run** y esperá que termine sin errores antes de probar el formulario.

Las columnas `businesses.latitude` y `businesses.longitude` ya existen. La actualización es necesaria porque `save_my_business` antes ignoraba esas propiedades. Ahora valida el par y sus rangos, y guarda coordenadas, datos comerciales y categorías dentro de la misma transacción, con la autorización y RLS existentes. No crea tablas, columnas de distancia, PostGIS ni políticas nuevas. No requiere ejecutar schema, seed ni realtime.sql.

Al crear sin capturar ubicación, ambas coordenadas permanecen NULL. Al editar sin tocar el botón de ubicación, el cliente omite las claves y la función conserva los valores actuales de la base. También sigue admitiendo formularios anteriores que no envían coordenadas.

## Comportamiento

- Un único helper llama a `navigator.geolocation.getCurrentPosition`, sólo desde botones explícitos. Maneja falta de soporte, rechazo, posición no disponible y timeout con mensajes amigables. El permiso no se pide al cargar una página.
- El comercio captura una ubicación pendiente dentro del formulario. La indicación **✅ Ubicación guardada** aparece después de guardar correctamente el formulario en Supabase. Capturar y salir sin guardar no modifica el comercio.
- La ubicación del comprador es independiente de la del comercio. Se guarda en un contexto y en `sessionStorage` bajo `cercaya.buyer-location.v1`, para esa sesión de navegador y origen. No requiere login ni se escribe en profiles, Supabase, URLs o logs. Si el navegador bloquea el almacenamiento, queda en memoria durante la navegación de la app.
- Recargar o navegar al detalle conserva la ubicación sin pedir permiso nuevamente. **Cambiar ubicación** vuelve a obtener la posición actual sólo al tocarlo. **No usar mi ubicación** borra la ubicación local e invalida una captura pendiente para que no vuelva a activarse al llegar su respuesta.
- No se traduce la posición a una dirección ni ciudad: la dirección y ciudad del comercio siguen siendo texto ingresado por su dueño.

## Cálculo y filtros

`src/lib/distance.ts` usa Haversine con radio terrestre de 6371 km. Calcula distancia aproximada en línea recta entre comprador y comercio; no representa distancia por calles ni tiempo de viaje. El formato es metros debajo de 1 km (`850 m`) y kilómetros con hasta un decimal (`1,8 km`).

Home y búsqueda muestran distancia cuando ambos puntos son válidos. En caso contrario muestran la ciudad del comercio, o el enlace de ubicación existente si tampoco hay ciudad. El detalle agrega **📍 A … de vos** junto a la dirección y ciudad sólo si puede calcularse.

**Menos de 5 km** usa la distancia sin redondear y acepta valores **menores o iguales a 5 km**. Excluye comercios sin coordenadas. **Más cerca** ordena distancias conocidas de menor a mayor, dejando las desconocidas al final. Sin ubicación del comprador, ambos controles están deshabilitados con indicación para activarla. Quitarla elimina el filtro geográfico activo, restablece el orden si era por distancia y vuelve a la primera página.

Para filtrar u ordenar por cercanía se descargan todos los candidatos públicos que cumplen los otros filtros en lotes de hasta 500, se calcula localmente, luego se pagina de a 12. Esto evita ordenar únicamente la primera página. Las coordenadas del comprador nunca se agregan a las consultas. Esta solución simple descarga más datos al usar cercanía; está pensada para esta etapa del catálogo. Las consultas pendientes se cancelan cuando cambia la búsqueda o se abandona la pantalla.

## Prueba manual: comercio

Usá una URL HTTPS accesible desde el dispositivo. En la computadora también sirve `http://localhost:3000` o `http://127.0.0.1:3000`. Desde un celular, `127.0.0.1` apunta al propio teléfono: usá una URL HTTPS válida que llegue a la app. Una IP de la computadora por HTTP puede abrir la web pero no habilitar geolocalización. No se configuró ni publicó un servidor HTTPS en esta tarea.

1. Ejecutá el SQL actualizado indicado arriba.
2. Estando **físicamente en el comercio**, iniciá sesión como su propietario y abrí `/comercio/editar`.
3. Buscá **Ubicación del comercio**. Revisá dirección y ciudad; leé el aviso de estar en el local.
4. Tocá **📍 Usar mi ubicación actual**. Si ya tenía coordenadas, el botón se llama **Actualizar ubicación**. Permití el acceso cuando lo pida el navegador.
5. Esperá **Ubicación obtenida. Guardá el formulario para confirmarla.** Después tocá **Guardar cambios**.
6. Debe aparecer **✅ Ubicación guardada**. Tocá **Volver a Mi comercio**, entrá otra vez a editar y comprobá **📍 Ubicación configurada**. La pantalla no muestra coordenadas técnicas.
7. Cambiá sólo la descripción y guardá. La ubicación debe seguir configurada, sin pedir permiso ni cambiar coordenadas. Si querés comprobar valores exactos, comparalos en tu Table Editor de `businesses` antes y después.
8. Para creación, repetí desde `/comercio/crear` con una cuenta sin comercio: completá los campos obligatorios y categorías, capturá estando en el local y tocá **Crear comercio**. También se puede crear sin capturar ubicación.
9. Opcional: rechazá el permiso. Debe aparecer un mensaje amigable y el formulario debe seguir permitiendo guardar los otros campos, conservando la ubicación previa si existía.

## Prueba manual: comprador en celular

1. Con un producto activo de ese comercio, abrí la Home en una URL HTTPS desde el celular. No hace falta iniciar sesión. El filtro **Hoy** inicial requiere stock positivo; podés limpiar filtros para buscar cualquier producto activo.
2. Antes de compartir ubicación, comprobá que la tarjeta muestre ciudad. **Menos de 5 km** y **Más cerca** deben estar deshabilitados.
3. Tocá **Usar mi ubicación** en el header y luego el botón con el mismo nombre dentro del diálogo. Aceptá el permiso y esperá **Tu ubicación está configurada**. Cerrá el diálogo con la X.
4. Buscá el producto del comercio: debe mostrar metros o kilómetros. Si estás en el mismo local, es normal ver una distancia cercana a cero; la precisión depende del dispositivo.
5. Activá **Menos de 5 km**. Sólo deben aparecer productos con distancia calculable de hasta 5 km; los comercios sin coordenadas quedan fuera.
6. Quitá ese filtro y elegí **Más cerca**. Con varios comercios, verificá distancia ascendente y productos sin coordenadas al final. Si hay varias páginas, continuá a la siguiente para revisar el orden global.
7. Abrí un producto. Junto al comercio debe aparecer **📍 A … de vos**, además de la dirección y ciudad. Volvé a Home y recargá: no debe volver a solicitar permiso automáticamente.
8. Abrí el selector del header y tocá **Cambiar ubicación** para capturar nuevamente tu posición, sólo si querés actualizarla.
9. Tocá **No usar mi ubicación** y cerrá el diálogo. Las tarjetas deben volver a ciudad, la opción Más cerca y el filtro de 5 km quedar deshabilitados y el catálogo volver a su primera página. Abrí el detalle: debe quedar dirección y ciudad, sin distancia. Recargá para comprobar que la ubicación sigue desactivada.

## Archivos creados (7)

- `src/lib/location.ts`: tipo, validación y captura compartida.
- `src/lib/distance.ts`: Haversine, cálculo nullable y formato.
- `src/components/location/user-location-provider.tsx`: contexto y sesión local del comprador.
- `src/components/location/buyer-location-controls.tsx`: usar, cambiar y quitar ubicación.
- `src/components/location/business-distance.tsx`: distancia dinámica en el detalle.
- `src/components/businesses/business-location-control.tsx`: captura explícita del comercio y errores.
- `LOCATION_SETUP.md`: esta guía.

## Archivos modificados (18)

- `src/app/layout.tsx`: proveedor global de ubicación.
- `src/components/demo-provider.tsx`: indicador real y diálogo compartido.
- `src/components/home/home-dialogs.tsx`: selector de ubicación real.
- `src/components/home/header.tsx`: elimina la zona demo.
- `src/components/marketplace.tsx`: ubicación del catálogo, filtros y paginación.
- `src/components/home/catalog.tsx`: orden por cercanía e indicación sin ubicación.
- `src/components/home/quick-filters.tsx`: habilita el filtro geográfico condicionalmente.
- `src/components/home/product-card.tsx`: formato de distancia real.
- `src/components/details/public-product-detail.tsx`: distancia cliente junto al comercio.
- `src/components/businesses/business-form.tsx`: sección de ubicación y confirmación después de guardar.
- `src/lib/businesses/form.ts`: coordenadas opcionales y error de ubicación.
- `src/lib/products.ts`: coordenadas públicas del comercio en el tipo Product.
- `src/lib/public-catalog.ts`: lectura de coordenadas y cercanía antes de paginar.
- `src/lib/use-public-catalog.ts`: cancelación de consultas pendientes.
- `supabase/business-rls.sql`: coordenadas opcionales en la transacción existente.
- `README.md`: estado actual y enlace a esta etapa.
- `BUSINESS_SETUP.md`: aviso de actualización de ubicación.
- `PUBLIC_CATALOG_SETUP.md`: aviso de actualización de distancia.

No se ejecutaron pruebas automáticas, suites, build, lint, typecheck, navegador, E2E ni SQL remoto. Queda pendiente tu prueba manual tras actualizar la función SQL.

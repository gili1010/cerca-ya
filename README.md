# CercaYa

**Encontralo cerca. Tenelo hoy.** Marketplace hiperlocal construido con Next.js App Router, TypeScript y Tailwind CSS.

## Desarrollo

Ubicación del comercio y cercanía del catálogo: [LOCATION_SETUP.md](LOCATION_SETUP.md). Volvé a ejecutar manualmente la versión actualizada de `supabase/business-rls.sql` para guardar coordenadas desde el formulario. La ubicación del comprador queda únicamente en su navegador.

Reservas reales y Realtime: [RESERVATION_SETUP.md](RESERVATION_SETUP.md). Ejecutar manualmente `supabase/reservation-rls.sql`, que incluye RLS, RPC transaccionales de stock y canales privados. No se importan reservas anteriores del navegador.

Actualizaciones en vivo de pedidos, Radar y ofertas: [REALTIME_SETUP.md](REALTIME_SETUP.md). Ejecutar manualmente sólo `supabase/realtime.sql` sobre la instalación existente. Reservas usa Supabase desde la etapa documentada en RESERVATION_SETUP.md.

Radar y ofertas reales: [RADAR_OFFERS_SETUP.md](RADAR_OFFERS_SETUP.md). Ejecutar manualmente los dos bloques de `supabase/radar-offer-rls.sql` en el orden indicado. Las reservas reales se configuran por separado en RESERVATION_SETUP.md.

Pedido Abierto real: [REQUEST_SETUP.md](REQUEST_SETUP.md). Requiere la instalación anterior de `supabase/request-rls.sql`. Los pedidos y ofertas pertenecen a la cuenta; no se importan datos de localStorage.

Foto principal con Supabase Storage: [PRODUCT_STORAGE_SETUP.md](PRODUCT_STORAGE_SETUP.md). Requiere ejecutar manualmente `supabase/product-storage.sql`. Una foto por producto, comprimida en el navegador.

Creación y gestión del comercio real: [BUSINESS_SETUP.md](BUSINESS_SETUP.md).

CRUD de productos del comercio autenticado: [PRODUCT_SETUP.md](PRODUCT_SETUP.md). Requiere tener instalado `supabase/product-rls.sql`.

Home, búsqueda y detalle con productos reales: [PUBLIC_CATALOG_SETUP.md](PUBLIC_CATALOG_SETUP.md). Esa etapa de lectura no requiere SQL adicional; las etapas posteriores de fotos y pedidos sí tienen los archivos indicados arriba.

Node.js 20.9 o posterior.

```bash
npm install
npm run dev
```

Abrir http://localhost:3000. Producción local: `npm run build` y `npm start`.

## Home

- Header con ubicación opcional del comprador, navegación de escritorio e inicio de sesión real.
- Buscador real por nombre, marca, modelo y descripción, sin distinguir mayúsculas. Categorías reales con filtro propio.
- Accesos a búsqueda, búsqueda con foto (deshabilitada) y formulario de necesidad.
- «Lo necesito hoy»: aplica cantidad positiva + stock confirmado y ordena por confirmación reciente.
- Categorías de Supabase y filtros combinables: Hoy, Con envío, Retiro y Stock confirmado. Con ubicación del comprador se habilitan Menos de 5 km y Más cerca.
- Cards con precio en ARS, comercio, distancia calculada o ciudad, stock, fecha real de confirmación y modalidades de entrega/retiro. Hasta 12 productos por página.
- Navegación móvil: Inicio, Buscar, Pedidos, Guardados, Cuenta.
- Favoritos compartidos entre pantallas durante la visita. Los nuevos pedidos, ofertas y reservas se guardan en Supabase; los datos demo anteriores permanecen locales.
- Diálogos nativos con foco de teclado contenido y cierre con Escape.

## Datos de ejemplo

La Home, búsqueda y detalle usan productos y comercios de Supabase, con stock informado por el comercio. Si el seed anterior sigue instalado, sus registros también pueden aparecer al cumplir los filtros; no se agregan mocks desde el frontend. El comprador puede compartir su ubicación con el navegador para calcular distancias en línea recta hacia comercios con coordenadas. Cuando falta alguna ubicación se muestra la ciudad. Las imágenes usan URLs de `product_images` o un placeholder local.

La autenticación, perfil, comercio, productos, catálogo, nuevos Pedidos Abiertos, Radar y ofertas usan Supabase. Las nuevas reservas también usan Supabase. No hay pagos ni IA. Configuración de registro, confirmación y sesión: [AUTH_SETUP.md](AUTH_SETUP.md).

## Pedido Abierto, Radar y ofertas

El comprador publica un pedido con su cuenta y puede cerrarlo o cancelarlo. El comercio autenticado ve pedidos OPEN vigentes en Radar mediante una proyección sin datos privados del comprador. Se priorizan sus categorías; las sugerencias comparan palabras con su catálogo real. No hay filtro geográfico ni distancias simuladas.

Se puede enviar una oferta manual o precargada con un producto. El servidor deriva el comercio de la sesión, comprueba disponibilidad y evita ofertas activas duplicadas. El estado inicial es PENDING. El comercio puede retirarla (WITHDRAWN); el comprador recibe los cambios en vivo y contacta por WhatsApp. No hay aceptación ni conversión a reserva.

| Ruta | Función |
| --- | --- |
| `/pedido/nuevo?q=...` | Crear pedido real con búsqueda precargada |
| `/pedido/[id]/confirmacion` | Confirmación de publicación en Supabase |
| `/pedidos` | Mis pedidos y contador real de ofertas |
| `/pedido/[id]` | Detalle propio, ofertas, cierre y cancelación |
| `/pedido/[id]/oferta/[offerId]` | Oferta privada del comprador y WhatsApp |
| `/comercio/radar` | Pedidos OPEN vigentes y coincidencias de catálogo |
| `/comercio/oportunidades` | Redirección a Radar |
| `/comercio/oportunidades/[id]/responder` | Enviar oferta manual o de producto propio |
| `/comercio/oferta-enviada/[id]` | Ver y retirar la oferta propia |
| `/demo/pedido/[id]` | Pedido y ofertas de la demo local anterior |
| `/demo/pedido/[id]/oferta/[offerId]` | Detalle local conservado para reservas demo |
| `/producto/[id]` y `/productos/[id]` | Detalle real de producto activo de comercio activo |

Los cambios de pedidos y ofertas se reciben mediante Realtime con canales privados. Se mantienen Actualizar, recarga y reentrada como respaldo. Los contadores incluyen ofertas retiradas como parte del historial recibido. Sólo PENDING/ACCEPTED bloquean un nuevo envío del mismo comercio al pedido.

La clave `cercaya.pedidos.v1` se conserva para demos anteriores; el Radar, las nuevas ofertas y las reservas reales no la leen ni escriben. No hay dual-write ni importación de registros anteriores. Para la demo local, `localhost:3000` y `127.0.0.1:3000` siguen teniendo almacenes diferentes.

Configuración, archivos de esta etapa, RLS y pasos manuales: [RADAR_OFFERS_SETUP.md](RADAR_OFFERS_SETUP.md).

## Estructura

La infraestructura inicial de Supabase está documentada en [SUPABASE_SETUP.md](SUPABASE_SETUP.md): esquema de 11 tablas, RLS y seed ficticio. Las guías de Auth, comercio y productos describen las integraciones reales posteriores. Las reservas históricas y demos anteriores mantienen sus datos locales; no se importan automáticamente.

```text
src/app/                        Home, layout, estilos y favicon
src/components/marketplace.tsx   Estado y coordinación de la Home
src/components/home/            Header, hero, mapa, categorías, filtros,
                                catálogo, cards, navegación, diálogos y footer
src/lib/products.ts             Tipos y catálogo simulado
src/lib/catalog.ts              Búsqueda, filtros y ordenamiento
src/types/requests.ts            Tipos Request, Offer y Business
src/data/                       Pedidos, ofertas y comercios mock separados
src/lib/request-domain.ts       Validaciones y transiciones puras de estado
src/lib/request-store.ts        Persistencia local y suscripción entre pestañas
src/components/requests/        Formularios y pantallas del flujo Pedido Abierto
src/lib/supabase.ts              Alias del cliente opcional anterior
src/lib/supabase/                Clientes públicos opcionales de navegador y servidor
src/types/database.ts           Contrato tipado del esquema SQL
supabase/schema.sql             Esquema inicial PostgreSQL y políticas RLS
supabase/seed.sql               Catálogo ficticio de desarrollo
tests/catalog.test.mjs          Pruebas del filtrado y los tiempos demo
tests/request-domain.test.mjs   Estados, ofertas, reservas y restauración de datos
```

## Validación

```bash
npm test
npm run lint
npm run typecheck
npm run build
```




# Auditoría del MVP de CercaYa

Fecha: 30 de septiembre de 2026. Auditoría estática del proyecto actual.

## Alcance y límites de la evidencia

Se revisaron rutas, componentes, clientes de Supabase, variables declaradas, permisos/RLS, funciones SQL, Storage, Realtime y documentación. Sólo se creó este archivo. No se modificó código, no se abrió navegador y no se ejecutaron tests, build, SQL remoto ni llamadas al proyecto Supabase.

No se leyó el contenido de `.env.local` ni se inspeccionaron credenciales. Su archivo existe, pero los valores y la configuración de Vercel no están verificados. Tampoco se comprobaron las políticas, funciones o datos efectivamente instalados en Supabase. «Implementado» significa que hay código conectado al servicio; no certifica funcionamiento del despliegue.

La carpeta actual no tiene un repositorio Git disponible. Hay `package-lock.json`; no se encontró `vercel.json`. La ausencia de este último no impide desplegar un proyecto Next.js convencional. El servidor local y su compilación anterior no constituyen evidencia de una versión de producción lista.

Los hallazgos distinguen hechos del código, riesgos deducidos y verificaciones pendientes. No se ejecutaron ataques ni reproducciones de fallos.

## 1. Funcionalidades que realmente usan Supabase

| Funcionalidad | Integración actual | Límite relevante |
| --- | --- | --- |
| Registro, login y logout | Supabase Auth, email/contraseña, sesiones y cookies con `@supabase/ssr` | Confirmación de correo depende de configuración externa. No hay recuperación de contraseña en la app. |
| Confirmación de cuenta | `/auth/confirm` verifica `token_hash` o intercambia `code` | La plantilla y Redirect URLs de producción no están verificadas. |
| Perfil propio | `profiles`, trigger de registro y recuperación desde el cliente autenticado | Se muestra nombre/teléfono; no se encontró formulario de edición del perfil. |
| Crear/editar comercio | `businesses`, `business_categories`, `save_my_business` | Un comercio por propietario. No hay proceso de verificación comercial en la UI. |
| Ubicación del comercio | Coordenadas guardadas en `businesses` con captura explícita | El backend valida rangos, pero no acredita que sea la ubicación física del local. |
| Productos | Consultas reales y RPC `save_my_product` / `manage_my_product` | Edición de stock absoluto y creación sin clave de idempotencia; ver C2 e I4. |
| Foto principal | Bucket público `product-images`, RPC de asociación y limpieza compensatoria | Una foto por producto. Un producto puede guardarse aunque falle después la imagen. |
| Home y búsqueda | Productos/categorías/comercios activos, filtros, precio, stock, fecha y paginación | Los registros ficticios del seed aparecen si siguen activos en la base. |
| Detalle público | `/producto/[id]`, datos reales y URL de WhatsApp | No hay una página pública real de comercio independiente; se muestra dentro del producto. |
| Pedido Abierto | `create_my_request`, lectura propia, cierre/cancelación y ofertas reales | La ubicación es opcional y queda fijada al publicar. |
| Ubicación privada del pedido | Coordenadas en `requests` con consentimiento al publicar | Requiere la última RPC de `request-location-radar.sql`. Hay riesgo de inferencia: C1. |
| Radar | `read_radar` y catálogo real del comercio | El radio se filtra en PostgreSQL cuando el pedido tiene coordenadas; pedidos sin ubicación siguen por categorías. |
| Ofertas | `create_my_offer`, `read_offers`, `withdraw_my_offer` | No existe aceptación de oferta ni conversión a reserva. WhatsApp es la continuación disponible. |
| Reservas | RPC de creación, lectura comprador/comercio y transiciones | Precio/envío derivados en SQL. Stock descontado al confirmar y restituido al cancelar una confirmada. |
| Realtime | Canales privados de pedidos, ofertas, Radar y reservas | Mantiene Actualizar como respaldo. El catálogo público no recibe cambios de stock en vivo. |

Evidencia principal: [AuthForm](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/auth/auth-form.tsx), [clientes Supabase](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/supabase/client.ts), [catálogo público](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/public-catalog.ts), [Radar real](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/real-radar.ts), [reservas SQL](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/reservation-rls.sql).

No hay pagos ni IA; no son requisitos técnicos para este piloto de contacto y reserva.

## 2. Qué sigue en memoria, almacenamiento local o demo

| Elemento | Fuente / persistencia | Situación |
| --- | --- | --- |
| Guardados | Estado React en `DemoProvider`, separado por ID de cuenta | Los productos se leen de Supabase, pero la selección se pierde al recargar. La tabla `favorites` existe y no se usa en este flujo. |
| Ubicación del comprador del catálogo | Contexto + `sessionStorage`, clave `cercaya.buyer-location.v1` | Intencional: no se envía a Supabase para buscar productos. Persiste en la pestaña y no se limpia al cerrar sesión. |
| Pedido/oferta/reserva históricos demo | `request-store`, `localStorage`, clave `cercaya.pedidos.v1` | No pertenecen a la cuenta real. Siguen accesibles en rutas demo y se inicializan desde pantallas que montan el aviso local. |
| Comercio público `/comercios/[id]` | `stores.ts` y catálogo estático `products.ts` | Nombres, direcciones, distancias, horarios y stock ficticios. No es una ficha real de Supabase. |
| Panel `/comercio` | Comercio real + imports/cálculo del catálogo demo | El panel principal enlaza a módulos reales, pero todavía carga código y datos antiguos innecesariamente. |
| Ilustración del hero | `NeighborhoodMap` | Visible y marcada como ilustración sin ubicación real; no es un mapa operativo. |
| Seed en Supabase | `supabase/seed.sql` | Tres comercios sin dueño y cinco productos de prueba, activos. Estar en PostgreSQL no los convierte en comercios reales. |
| Búsqueda por foto, foto del Pedido Abierto y estadísticas | Botones/textos «Próximamente» | Funciones ausentes, no integraciones reales ni errores ocultos. |

El nombre `DemoProvider` no significa que toda la Home sea demo: también sostiene navegación, ubicación indicada y favoritos del flujo real. No debería eliminarse entero sin separar esas responsabilidades.

Evidencia: [SavedProducts](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/auth/saved-products.tsx), [DemoProvider](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/demo-provider.tsx), [ubicación local](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/location/user-location-provider.tsx), [almacén histórico](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/request-store.ts), [seed](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/seed.sql).

## 3. Rutas, duplicaciones y navegación

| Ruta / grupo | Estado | Acción propuesta, sin implementar |
| --- | --- | --- |
| `/`, `/producto/[id]` | Catálogo y detalle reales | Conservar. Búsqueda vive en Home, no existe ruta `/buscar`. |
| `/productos/[id]` | Alias del mismo detalle real; reexporta página/metadata | Definir URL canónica; puede conservarse como compatibilidad. No es otra implementación. |
| `/comercios/[id]` | Ficha pública completamente demo | Retirar de la versión pública o aislarla explícitamente. No pasar UUID de comercios reales a esta ruta: su lookup sólo conoce mocks. |
| `/demo/pedido/[id]` y `/demo/pedido/[id]/oferta/[offerId]` | Flujos locales antiguos, publicados sin barrera de entorno | Excluir del lanzamiento. Sus enlaces de regreso apuntan también a `/pedidos`, que ahora es real. |
| `/pedidos`, `/pedido/nuevo`, detalle/confirmación/oferta | Flujos reales, protegidos en servidor y cliente | Conservar; verificar autorización con cuentas diferentes después. |
| `/comercio/oportunidades` | Redirige a `/comercio/radar` | Compatibilidad razonable, no pantalla duplicada de Radar. |
| `/comercio/oportunidades/[id]/responder` | Formulario de oferta real | Navegación presente desde Radar. No requiere renombrarlo para el piloto. |
| `/comercio/oferta-enviada/[id]` | Detalle real de oferta propia | Falta listado/historial general: cuando un pedido deja Radar, ese enlace se vuelve difícil de encontrar. |
| `/comercio` | Panel accesible sin login, enlaces llevan a módulos protegidos | Definir entrada de vendedor/onboarding clara; no confundir esto con exposición de datos privados. |
| `/comercio/productos` y nuevo/editar | CRUD real, pero usan `RequestShell business` sin `realRequests` | Se muestra «Demo local» y se monta el store de localStorage. Es una integración de shell desactualizada. |
| `/comercio/crear`, `/comercio/editar`, `/comercio/mi-negocio` | Comercio real | No están duplicadas; creación/edición comparten formulario. |
| `/reservas`, `/reserva/[id]`, confirmación y equivalentes comerciales | Reservas reales | Conservar. «Pedidos» y «Reservas» son conceptos distintos, no pantallas duplicadas. |
| `/guardados` | Lista real con IDs guardados sólo en memoria | Desde Cuenta se llega aquí; la navegación móvil dirige a Home con el tab de guardados. Dos accesos y estado no durable. |
| `/login`, `/registro`, `/auth/confirm`, `/cuenta` | Auth/perfil reales | Falta recuperación de contraseña y edición de perfil, no hay rutas que las implementen. |

Las tarjetas de productos reales enlazan al comercio dentro del detalle del producto, evitando la ficha demo. Las tarjetas ficticias de `/comercios/[id]` enlazan a productos con IDs como `taladro`; el detalle real espera UUID y esos enlaces terminan en «Producto no disponible».

En móvil, `DetailShell` marca Inicio incluso en Cuenta/Guardados, y `RequestShell` marca Pedidos incluso en pantallas del vendedor. No altera RLS, pero dificulta entender dónde está el usuario.

Evidencia: [ruta demo de comercio](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/app/comercios/[id]/page.tsx), [ruta de productos comerciales](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/app/comercio/productos/page.tsx), [RequestShell](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/requests/request-shell.tsx), [DetailShell](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/details/detail-shell.tsx), [ofertas reales](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/requests/real-offers.tsx).

## 4. Código antiguo y código sin consumidores encontrados

La búsqueda de imports/referencias permite identificar candidatos, pero no reemplaza un análisis ejecutado del bundle. No se propone borrar archivos durante esta auditoría.

**Sin consumidores encontrados en el código de la app:**

- `src/components/requests/request-list.tsx`: lista local sustituida por `BuyerRequestList`.
- `src/components/requests/request-confirmation.tsx`: confirmación local sustituida por `BuyerRequestDetail` con `confirmation`.
- `src/components/requests/opportunities.tsx`: alias `Opportunities` de Radar; las rutas importan Radar directamente.
- `src/components/details/fulfillment-options.tsx`: modalidades y reserva del detalle antiguo.
- `src/lib/supabase.ts`: alias `getSupabaseClient`; el código actual usa la entrada nueva.
- Exportaciones `reservationActions` y `useReservations` de `request-store.ts`: las rutas de reservas ya usan `useRealReservations`.
- Exportaciones `ReservationSummary` y `MissingReservation` de `reservation-common.tsx`: presentaciones locales sustituidas en el flujo real.

**Legacy todavía usado, por lo que no está muerto:**

- `request-detail.tsx`, `offer-detail.tsx` y `offer-card.tsx`: usados por rutas `/demo`.
- `stores.ts`, productos ficticios, `StoreLocation`, `DemoNotice` y `ProductStock`: usados por la ficha demo de comercio.
- `request-store.ts`, `request-domain.ts`, `reservation-domain.ts`, `request-availability.ts` y `src/data/*`: cadena del almacén local y reglas demo; además se monta desde el shell de productos reales.
- `src/lib/radar.ts`: el panel sigue importando `businessCatalog`, aunque el Radar actual usa `real-radar.ts`. Sus antiguos cálculos de oportunidades no alimentan el Radar real.
- `src/lib/catalog.ts`: `normalize` sigue usado por `ProductList`, que también se usa en Guardados. No eliminar el módulo completo sólo porque sus antiguos filtros sean demo.
- `reservation-common.tsx`: componentes de totales, producto, progreso y badges siguen usados por reservas reales.

La documentación histórica también conserva instrucciones antiguas: `AUTH_SETUP.md` habla de módulos locales y `PUBLIC_CATALOG_SETUP.md` describe reservas locales; sus etapas posteriores están documentadas aparte. README todavía dice que Radar no tiene filtro geográfico y no enlaza la última guía de ubicación de pedidos. Hace falta una guía de instalación/estado vigente para evitar operar la versión equivocada.

## 5. CRÍTICO ANTES DE LANZAR

### C1. La distancia privada precisa permite inferir la ubicación del pedido

**Riesgo deducido del código; no explotado.** `read_radar` no devuelve coordenadas, pero sí la distancia como double precision. El propietario puede modificar las coordenadas del comercio en `save_my_business` y mediante los permisos UPDATE de `businesses`. No hay verificación de ubicación ni límite de consultas en esas funciones.

Un comerciante malicioso podría mover los puntos declarados y observar varias distancias del mismo pedido. Combinadas permiten inferir la ubicación por trilateración. El filtro de radio restringe qué pedidos se devuelven, pero no impide repetir consultas desde puntos próximos. Redondear sólo el texto de la tarjeta no protege el valor recibido por RPC.

**Cierre propuesto:** definir la precisión privada que se entrega en el servidor, restringir cambios de ubicación comercial y acceso de comercios no aprobados, y revisar el resultado frente a inferencia repetida. Reducir precisión por sí solo no garantiza anonimato. Hasta resolverlo, evitar abrir el Radar con coordenadas precisas a comercios no controlados. La lectura directa por RLS y la protección frente a inferencia son problemas distintos.

Evidencia: [retorno de Radar](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/request-location-radar.sql:66), [edición de coordenadas](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/business-rls.sql:124), [grants de negocios](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/schema.sql:261).

### C2. Una edición antigua del producto puede reponer stock reservado

**Hecho de la implementación; reproducción pendiente.** El formulario conserva todos los campos iniciales y `save_my_product` escribe `stock_quantity` de forma absoluta sin comparar una versión esperada.

Ejemplo: el vendedor abre Editar con stock 10; después confirma una reserva de 2 y la base queda en 8; vuelve al formulario anterior, cambia sólo la descripción y guarda. Ese formulario envía 10 y la RPC vuelve a escribir 10. El bloqueo de fila serializa las escrituras, pero no detecta el dato viejo de la pantalla. Se puede perder el descuento de una reserva y ofrecer unidades inexistentes.

**Cierre propuesto:** separar la intención de modificar stock de la edición de otros datos o incorporar control de versión/conflictos; acordar que el stock informado es disponible, excluyendo lo ya reservado. Verificar después la edición paralela a confirmar/cancelar reservas.

Evidencia: [snapshot del formulario](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/merchant-products/product-form.tsx:43), [guardado completo](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/merchant-products/product-form.tsx:72), [asignación absoluta](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/product-rls.sql:87).

### C3. No hay evidencia de que la instalación SQL corresponda a la versión del frontend

**Verificación pendiente, no afirmación de migración faltante.** Las funciones se instalaron por scripts manuales y algunos archivos fueron actualizados después de ejecutarse originalmente. `save_my_business` debe ser la versión que admite coordenadas; `create_my_request` debe tener la firma ampliada y `read_radar` devolver `distance_km`.

Tener los archivos locales no demuestra que se ejecutaron. Si falta la última actualización, pueden fallar las publicaciones, no filtrarse el radio o llegar respuestas sin `distance_km`. El código de las tarjetas presupone `number | null`, no una propiedad ausente.

**Cierre propuesto:** registrar versiones y comprobar en el proyecto destinado al piloto las funciones, grants, RLS, triggers y políticas de Storage/Realtime. No repetir schema/seed sobre una instalación activa. Una lectura estática no certifica permisos remotos.

Evidencia: [contrato TypeScript](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/types/database.ts), [última actualización SQL](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/request-location-radar.sql), [guía actual](C:/Users/lucia/OneDrive/Desktop/CercaYa/REQUEST_LOCATION_RADAR_SETUP.md).

### C4. Demo visible en rutas públicas y pantallas de operación real

**Confirmado en rutas y componentes; contenido remoto pendiente.** `/comercios/[id]` y `/demo/pedido/...` están publicadas; el CRUD real de productos muestra Demo local e inicializa mocks en localStorage. Además el seed inserta negocios sin dueño y productos activos: si siguen instalados, el catálogo público puede mostrarlos y permitir reservas hacia comercios que no tienen operador.

**Cierre propuesto:** aislar rutas demo y quitar el aviso/almacén local de pantallas reales; desactivar selectivamente registros ficticios en la base del piloto, conservando categorías legítimas. Asegurar que cada publicación visible pertenece a uno de los cinco comercios participantes. No borrar datos reales ni repetir el seed.

Evidencia: [shell de productos reales](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/app/comercio/productos/page.tsx), [inicialización de mocks](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/request-store.ts:23), [negocios ficticios activos](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/seed.sql).

### C5. El despliegue y el alta de cuentas reales aún no están certificados

**Verificación pendiente.** No hay evidencia de build actual apto para producción, proyecto Vercel conectado, variables de Preview/Production, dominio HTTPS, callbacks Auth y correo entregado a usuarios del piloto. La configuración documentada sigue usando localhost para desarrollo. El incidente anterior de `npm start` mostró que una compilación antigua puede ocultar cambios.

**Cierre propuesto:** fijar una versión identificable, configurar el entorno público y verificar registro/confirmación/login en su dominio. Autorizar en una etapa posterior una validación de producción y una prueba manual del flujo. Esta auditoría no las ejecutó.

Evidencia: [scripts del proyecto](C:/Users/lucia/OneDrive/Desktop/CercaYa/package.json), [configuración pública](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/supabase/config.ts), [callback por origen](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/auth/auth-form.tsx), [configuración Auth local](C:/Users/lucia/OneDrive/Desktop/CercaYa/AUTH_SETUP.md).

## 6. IMPORTANTE

| ID | Hallazgo | Impacto y cierre propuesto |
| --- | --- | --- |
| I1 | Guardados se pierden al recargar | Incluso volver del login con navegación completa puede perderlos. Definir persistencia o comunicar esta limitación del piloto; la tabla ya existe pero no está integrada. |
| I2 | Ubicación local no se separa por cuenta ni se borra en logout | En un dispositivo compartido, otra cuenta puede ver reutilizada la ubicación anterior y encontrarla preseleccionada al publicar. Limpiar o pedir consentimiento contextual al cambiar usuario; conservar la opción de ubicación anónima de catálogo. |
| I3 | Recuperación de contraseña y edición de contacto ausentes | Una cuenta bloqueada depende de ayuda administrativa. Acordar soporte para piloto; completar recuperación antes de ampliar público. |
| I4 | Creación de producto no idempotente | Si el INSERT se confirma pero se pierde la respuesta, el formulario todavía puede tener ID null y un reintento crear otra publicación. Agregar una intención recuperable antes de escalar, sin confundirlo con los reintentos de foto ya contemplados. |
| I5 | Catálogo no escucha stock de reservas en vivo | Refresca por cambios de búsqueda o foco; una pestaña abierta puede conservar stock previo. SQL revalida reservas/confirmaciones, pero la promesa visual no equivale a inventario sincronizado. Definir actualización y mensajes de disponibilidad. |
| I6 | La foto y el producto se guardan en pasos separados | Hay compensación y aviso, pero salir con error puede dejar publicación sin foto u objetos sin uso. Revisar procedimiento de recuperación y limpieza; no afirmar transacción conjunta. |
| I7 | Campos comerciales no son reglas efectivas de reserva | Se guardan `minimum_order` y `delivery_radius_km`, pero `create_my_reservation` no impone mínimo ni cobertura de envío. No prometer esas condiciones como aplicadas automáticamente. Para piloto, acordar mínimo 0 y coordinación explícita si se habilita envío. |
| I8 | Reservas con envío carecen de destino y contacto operativo | La reserva/proyección no recoge dirección de entrega ni muestra contacto del comprador al comerciante. El flujo real tiene botones de estado, pero no resuelve cómo entregarlo. Piloto con retiro y número de reserva; envío sólo mediante coordinación explícita del comprador por WhatsApp, sin incorporar tracking/logística. |
| I9 | No hay listado de ofertas propias fuera de Radar | Ofertas históricas pueden quedar sin acceso claro cuando el pedido cierra/vence. Definir acceso a historia antes de exigir seguimiento cotidiano. |
| I10 | Oferta recibida no se convierte en reserva | Es una limitación de alcance, no una transición rota. Explicar que la oferta se continúa por WhatsApp; no enseñar el flujo de reservar una oferta demo como si fuera real. |
| I11 | Vencimiento mostrado y status persistido difieren | Requests/reservas PENDING vencidas pueden seguir OPEN/PENDING en la base; la UI deriva EXPIRED y SQL bloquea acciones vencidas. No calcular métricas administrativas sólo por status ni reabrir datos por error. |
| I12 | Sin controles de abuso específicos de la app | No se encontraron cuotas para publicar pedidos/ofertas/reservas ni aprobación comercial que condicione Radar. Signup y alta comercial permiten comercios activos sin verificación. El rate limit del proveedor no puede suponerse como protección de negocio. Limitar el piloto a cuentas conocidas y evaluar apertura. |
| I13 | Grants directos permiten saltarse validaciones de ciertas RPC | Requests/products/businesses conservan INSERT/UPDATE por columnas con RLS de dueño. No permiten escribir registros ajenos, pero clientes propios pueden eludir validaciones del formulario/RPC. Revisar que constraints/policies cubran duración, radio, formato, stock y URLs importantes. Ofertas/reservas sí revocan escrituras directas. |
| I14 | Privacidad operativa sin política de retención accesible | El footer no ofrece contacto de soporte ni aviso sobre ubicación privada almacenada al publicar. Definir quién accede, cómo retirar un pedido/datos y qué hacer con registros del piloto. No se emitió una evaluación jurídica. |
| I15 | Guard de claves no cubre todo secreto posible | `getSupabaseConfig` rechaza `sb_secret_`, pero una clave JWT antigua de tipo service_role no queda identificada por ese prefijo. No se detectó uso de service_role en código ni se leyeron valores reales. Verificar manualmente que NEXT_PUBLIC sólo contenga clave anon/publishable. |
| I16 | Seguridad de imágenes no equivale a imágenes privadas | El bucket es público: desactivar un producto no retira una URL de imagen ya conocida. Las URLs manuales HTTP(S) tampoco se restringen al host de Supabase en la lectura. Acordar contenido público y revisar permisos/URLs en la base del piloto. |

Evidencia adicional: [producto y foto](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/merchant-products/product-form.tsx), [compensación Storage](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/merchant-products/photo-storage.ts), [reglas y campos de reservas](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/reservation-rls.sql), [estados derivados](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/lib/real-reservations.ts), [grants iniciales](C:/Users/lucia/OneDrive/Desktop/CercaYa/supabase/schema.sql), [logout](C:/Users/lucia/OneDrive/Desktop/CercaYa/src/components/auth/account.tsx).

## 7. PUEDE ESPERAR

- Eliminar exportaciones legacy no utilizadas y separar nombres demo de componentes compartidos; aislar lo públicamente visible sí pertenece a C4.
- Consolidar alias de rutas y tabs móviles sin rediseñar la aplicación.
- Mejorar historial de nombres de productos en reservas: el precio se conserva en la reserva, pero título/comercio se leen de registros actuales.
- Optimizar búsqueda/cercanía: se descargan todos los candidatos en lotes antes de filtrar/ordenar localmente. Es correcto para el orden global, pero crece con el catálogo y se repite al consultar páginas. Radar/reservas también descargan páginas hasta completar los resultados.
- Reducir trabajo de `proxy.ts`: se aplica a casi todas las páginas y marca respuestas no-cache. Priorizar rendimiento después de certificar protección y flujos.
- Mejorar SEO/canonical, mensajes de errores, observabilidad y accesibilidad después de resolver bloqueos; no se hizo auditoría visual.
- Estadísticas, múltiples fotos y búsqueda por foto quedan fuera del cierre inmediato.
- Mapas, PostGIS, rutas, tracking, logística, pagos e IA no son necesarios para probar este MVP.

## 8. Seguridad existente que conviene conservar

- RLS en tablas de negocio; perfiles/pedidos completos limitados a su dueño en los scripts inspeccionados.
- Radar identifica el comercio desde `auth.uid()`, devuelve columnas explícitas y aplica el radio en SQL; el envío de ofertas vuelve a comprobarlo.
- Funciones SECURITY DEFINER revisadas con autorización, `search_path` vacío y EXECUTE restringido. No se encontró uso de service_role en los clientes de la app.
- Reservas/ofertas revocan escritura directa y tienen RPC con controles de participantes. Confirmar/cancelar reservas usa bloqueos e idempotencia para evitar doble descuento/devolución dentro de esas transacciones.
- Realtime privado; el evento comercial de Radar sólo notifica REFRESH. Las coordenadas no se transmiten por ese canal. Hay restricciones para evitar que clientes publiquen avisos falsos.
- `safeRedirect` rechaza destinos externos y el proxy/callback usan no-store para sesiones.
- Precios/totales de reserva se derivan en PostgreSQL, no se aceptan importes del comprador como autoridad.

Estas protecciones son evidencia favorable del código, no certificación del proyecto remoto. Tampoco solucionan por sí solas C1 o C2.

## 9. Qué falta para publicar en Vercel

### Preparación del artefacto

1. Resolver C1/C2 y aislar demos visibles. Documentar una versión de release; adoptar repositorio Git remoto si se usará integración Git de Vercel. También es posible definir otro mecanismo de entrega, pero debe ser reproducible.
2. Conservar lockfile e instalación reproducible. La app usa App Router, cookies de servidor, callback y proxy: necesita despliegue Next.js con ejecución de servidor, no exportación estática.
3. En una etapa posterior autorizada, obtener un build de producción exitoso de esa versión. No reutilizar `.next` local antiguo ni publicar el resultado de `npm run dev`.

### Variables y servicios

4. Configurar `NEXT_PUBLIC_SUPABASE_URL` y una de `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` en el entorno correspondiente. `.env.local` no se publica automáticamente. Si ambas claves están configuradas, publishable tiene prioridad. Ninguna debe ser service_role/secret. Recompilar/republicar cuando cambien los valores públicos.
5. Verificar todas las etapas SQL del proyecto: esquema existente, Auth/profiles, business actualizado, productos, Storage, requests, ofertas/Radar, Realtime, reservas y última actualización de ubicación de pedidos. Para un proyecto existente, aplicar sólo cambios pendientes en orden; los archivos históricos no son una orden para reejecutarlos todos.
6. Publicar en un dominio HTTPS y elegir el origen principal. En Supabase Auth, actualizar Site URL, permitir `/auth/confirm` con sus parámetros de retorno para ese dominio y revisar los orígenes de Preview autorizados. Evitar que la configuración productiva envíe al comprador a localhost.
7. Revisar plantilla de confirmación, entrega de correo a destinatarios reales y SMTP/límites aplicables al proyecto. Probar confirmación desde otro dispositivo si ése será el uso del piloto.
8. Verificar bucket público y políticas de subida/borrado; canales privados Realtime y sesión válida. Vercel aloja la app; PostgreSQL, Storage y Realtime siguen en Supabase.

### Criterios de habilitación

9. Probar manualmente en el dominio público registro/login/logout, acceso de cuentas ajenas, CRUD/foto, stock/reservas, pedido ubicado/no ubicado, radio y reconnect de Radar. Se propone para después, no se ejecutó aquí.
10. Preparar respaldo y procedimiento de revertir la app/cambios de base sin repetir seed ni borrar operaciones del piloto. Tener un contacto de soporte y un responsable de incidencias.

No se encontraron URLs localhost hardcodeadas en el código operativo inspeccionado. Los callbacks se construyen desde `window.location.origin` o la request; las referencias locales encontradas están en documentación. El riesgo principal está en la configuración externa de Auth y los orígenes, cuyos valores no fueron verificados.

La guía local de Next instalada confirma que funciones de servidor requieren un despliegue compatible: [Deploying](C:/Users/lucia/OneDrive/Desktop/CercaYa/node_modules/next/dist/docs/01-app/01-getting-started/17-deploying.md). No se inspeccionó una cuenta Vercel ni se certificaron límites/planes de proveedor.

## 10. Preparación del piloto con cinco comercios

| Preparación | Criterio para empezar |
| --- | --- |
| Participantes | Cinco cuentas comerciales distintas, con comercio propio y operador identificado; compradores con cuentas separadas. No usar una sesión común ni `comprador-demo`. |
| Datos | Cada comercio con ciudad, dirección, WhatsApp con código de país, ubicación del local y varias publicaciones reales con fotos y stock actual. Sin seed comercial visible. |
| Geografía | Algunos locales dentro del radio de un comprador y uno fuera para comprobar exclusión. Geolocalización en HTTPS y consentimiento explícito. |
| Modalidad | Retiro como flujo base. Explicar que la reserva se confirma por el comercio y que no hay cobro. Si hay envío, coordinación manual explícita antes de prometer entrega. |
| Stock | Acordar definición de stock disponible y quién lo actualiza. Resolver C2 antes de recibir reservas reales en paralelo. |
| Pedido Abierto | Ensayar pedido con radio 10 km y otro sin ubicación. Oferta/contacto por WhatsApp; no prometer aceptación automática ni conversión a reserva. |
| Privacidad | Verificar desde otra cuenta que no se leen requests/perfiles ajenos; inspeccionar la proyección y revisar el riesgo de inferencia C1. SQL Editor administrativo no prueba RLS de clientes. |
| Realtime | Radar/reservas abiertos al publicar/confirmar/cancelar; desconectar/reconectar y comprobar que Actualizar recupera datos. |
| Soporte | Responsable, canal y protocolo para reserva vencida, falta de stock, problemas de correo/fotos y cancelaciones. Recuperación de cuenta asistida si todavía no hay UI. |
| Registro de resultados | Anotar publicación → contacto/oferta → reserva → retiro, incidencias y tiempos con IDs de operación. No registrar coordenadas precisas ni tokens en planillas o capturas compartidas. |

No hace falta construir un panel analítico para este piloto. Un registro manual y un horario de atención acordado permiten evaluar demanda y fiabilidad con el alcance actual.

## 11. Orden corto de trabajo para cerrar el MVP

1. **Privacidad e inventario:** resolver inferencia de ubicación C1 y sobrescritura de stock C2; definir modalidades y límites reales del piloto.
2. **Una sola experiencia real:** aislar demos, corregir el shell de productos, desactivar seed comercial visible y preparar cinco comercios con catálogo verificable.
3. **Instalación y release:** registrar versión SQL vigente, configuración Auth/Storage/Realtime, variables y dominio HTTPS; generar la release de Vercel cuando se autorice validar/desplegar.
4. **Prueba manual controlada:** completar la matriz de cuentas, privacidad, radios, concurrencia, confirmación/cancelación y recuperación de conexión; corregir sólo fallos del flujo existente.
5. **Piloto acompañado:** operar con cinco comercios, soporte y métricas manuales. Resolver persistencia de Guardados e historial/contacto según las incidencias, antes de ampliar convocatoria.

El núcleo real está implementado y tiene bases de autorización y transacciones. La apertura pública debe esperar los bloqueos críticos y la comprobación del entorno efectivo. Esta auditoría no aplicó ninguna corrección.

# QA de lanzamiento — CercaYa

## Resultado vigente — segunda pasada, 10 de octubre de 2026

**READY FOR BARRIAL BETA**, con alcance de beta controlada y límites documentados. No quedan BLOCKER ni HIGH confirmados abiertos. El resultado histórico de primera pasada se conserva abajo y ya no representa el estado actual.

| Validación final | Resultado |
|---|---|
| TypeScript: npx tsc --noEmit | PASS, salida 0 |
| Build: npm run build | PASS, salida 0, 39 páginas estáticas |
| npm test | PASS, 24/24 |
| Lint | FAIL, 46 errores legacy y 5 warnings; clasificación por archivo más abajo, sin reglas cambiadas ni silencios masivos |
| Búsqueda real sin tildes/case y persistencia | PASS |
| Analytics: evento explícito / refresh sin duplicado | PASS |
| Las 11 rutas Admin solicitadas | PASS |
| Verificación, auditoría y estado restaurado | PASS |
| Comprador distinto del comerciante / pedido completo | PASS, ON_DEMAND, retiro, ARRANGE |
| Pedido Abierto / Radar / oferta recibida / cancelación | PASS, sin ubicación |
| Reporte autenticado / descarte Admin | PASS |
| Contacto autenticado | PASS UI; entrega al buzón no certificada |
| Logout y protección de pantalla privada | PASS |

QA-001 a QA-007 corregidos y comprobados en la primera pasada. QA-009 (persistencia) y QA-010 (normalización) corregidos y retesteados en la segunda. QA-008 queda como deuda legacy de lint, sin fallo funcional importante demostrado. No se modificó código durante la reanudación final: se continuó el working tree y se actualizó este mismo informe.

Pendientes/NOT TESTED: deployment actualizado en Vercel; Google OAuth/recovery entre dispositivos y buzón externo requieren intervención del titular; ubicación real/radio con dos cuentas no probados para evitar nuevas coordenadas; E2E STOCKED y envío/otros pagos no cubiertos por el pedido ON_DEMAND; Realtime instantáneo no certificado con cambio de sesiones; rechazo RPC directo de verificación no Admin no ejercitado (rechazo de /admin sí PASS). Revisar incidente aislado de navegación al detalle de reporte en sesión estable. Estos límites no representan fallos confirmados y no bloquean la beta barrial de alcance probado. No es certificación para lanzamiento masivo.

Limpieza: comercio verificado; cuatro productos originales intactos; producto QA inactivo; pedido entre cuentas completado; pedido QA del corte vencido; Pedido Abierto QA cancelado; reporte QA descartado. Imágenes y registros QA conservados como historial, no se borraron datos reales. SQL aplicado manualmente por usuario; agente no ejecutó SQL remoto. Servidor de producción QA detenido al cierre.

Fecha: 9 de octubre de 2026, America/Buenos_Aires.

## Resumen ejecutivo — primera pasada histórica

| Indicador | Cantidad |
|---|---:|
| BLOCKERS confirmados | 0 |
| HIGH | 1, corregido |
| MEDIUM | 7, cuatro corregidos y tres pendientes |
| LOW | 2, corregidos |
| FIXED | 7 |
| PENDING | 3 |

**NOT READY FOR BARRIAL BETA** bajo una puerta de calidad que exige lint limpio: quedan 48 errores de lint y dos limitaciones de búsqueda documentadas. No se demostró un BLOCKER funcional ni un HIGH abierto en los flujos ejecutados. Build y TypeScript pasan. Esta conclusión no significa que los flujos privados hayan fallado: su validación con cuentas de comprador, comerciante y Admin sigue **NOT TESTED**. No corresponde certificarlos con resultados anónimos.

No se ejecutó SQL remoto, no se cambiaron configuraciones remotas, no se borraron datos reales y no se enviaron pedidos, ofertas, reportes ni consultas reales. No se subieron imágenes ni se enviaron emails. Se utilizó un carrito local del navegador de QA y una única tentativa de login con datos ficticios de un dominio reservado. Al finalizar se retiraron sólo las dos líneas creadas para QA de ese carrito local; la pantalla confirmó que quedó vacío. Se cerró la pestaña temporal y se detuvo el servidor de QA.

## Entorno y evidencia

- Windows, proyecto local en `C:/Users/lucia/OneDrive/Desktop/CercaYa`, Node.js 24.14.0, Next.js 16.3.6.
- Configuración local existente `.env.local`; se comprobó presencia de variables sin divulgar valores. La app se conecta al proyecto Supabase configurado: no se asumió que fuera un entorno descartable.
- Servidor de desarrollo y luego servidor de producción `next start`, en `http://localhost:3000`. No se probó un deployment nuevo en Vercel ni el dominio oficial.
- Navegador integrado, sesión anónima, Home a 1366×768, 768×900 y 390×844. Registro, tienda y carrito revisados también en móvil.
- Se solicitó información sobre entorno/cuentas descartables. No hubo credenciales ni sesiones de comprador, comerciante o Admin disponibles durante esta revisión.
- Los IDs nulos usados en rutas son UUIDs sintéticos, no datos de usuarios. La tienda real y sus productos se abrieron desde enlaces observados en el catálogo público.

### Comandos y resultados

| Validación | Resultado final | Observación |
|---|---|---|
| `npm run typecheck` (`tsc --noEmit`) | PASS, salida 0 | Inicialmente falló por validadores generados que todavía importaban la ruta legacy retirada. |
| `npm run lint` (`eslint .`) | FAIL | Primera ejecución: 51 errores, 8 warnings. Conteo final con la API de ESLint sobre `.`: 48 errores, 8 warnings. No se desactivaron reglas. |
| `npm test` | PASS | 22 pruebas, 22 aprobadas, 0 fallidas. Incluye 15 casos existentes de demo y 7 regresiones nuevas; no prueba transacciones de PostgreSQL. |
| `npm run build` | PASS | Build final compiló, terminó TypeScript y generó 39 páginas estáticas. |
| `npm run dev` / `npm run start` | PASS | Servidores locales iniciados para revisión. El servidor utilizado para QA se detiene al finalizar. |
| Barrido HTTP anónimo | PASS en los casos esperados | 47 URLs; estados, redirects y Cache-Control revisados. Un producto inexistente usa un estado amigable con HTTP 200. |
| Casos negativos de `/api/contacto` | PASS | Seis casos, sin persistencia ni envío de email. |
| Escaneo de hardcodes | Completado | 313 archivos de texto fuera de dependencias/cachés/entornos; revisión específica de `src`, `public`, `supabase`, tests y documentación. |
| Escaneo de secretos en assets públicos compilados | Sin coincidencias | 54 archivos; se compararon los valores configurados de las tres variables privadas relevantes sin imprimirlos. |

Los primeros intentos de build encontraron un acceso denegado de SWC dentro del sandbox y después un error EPERM en el caché generado. Se detuvo el servidor de QA y se archivó `.next` temporalmente fuera del proyecto; código y datos intactos. El build limpio y el final pasaron. Estos errores de entorno no se presentan como bugs de producción. El primer barrido HTTP desde el sandbox no pudo conectar; se repitió fuera de esa restricción y completó.

## Hallazgos priorizados

| ID | Severidad | Área | Bug | Pasos para reproducir | Resultado esperado | Resultado actual / evidencia | Estado |
|---|---|---|---|---|---|---|---|
| QA-001 | HIGH | Privacidad / formularios | Teléfono personal hardcodeado como placeholder en comercio y checkout | Abrir crear/editar comercio o checkout y revisar placeholder; buscar el número señalado en el repositorio | Ejemplo genérico, sin teléfono personal | Dos literales en `business-form.tsx` y `reservation-checkout-fields.tsx`; reemplazados por «Código de área + número». Escaneo final sin coincidencias del teléfono en código | FIXED |
| QA-002 | MEDIUM | Contacto | JSON malformado se trataba como indisponibilidad del servidor | POST local, origen propio, Content-Type JSON, cuerpo `{` | HTTP 400 | El catch exterior devolvía 503; después de la corrección devuelve 400 en el build final | FIXED |
| QA-003 | MEDIUM | Checkout | La validación de medio de pago aceptaba propiedades heredadas | Invocar validación con `payment_method: "toString"`, `"constructor"` o `"__proto__"` | Rechazo | El operador `in` aceptaba esos nombres; `Object.hasOwn` los rechaza. No se demostró un cobro o pedido inválido guardado: PostgreSQL tiene su propia validación | FIXED |
| QA-004 | MEDIUM | Pruebas | Cargador del dominio demo no resolvía imports `@/` | Ejecutar `npm test` | Ejecutar la suite | ENOENT al intentar cargar `src/lib/@/lib/distance.ts`; cargador corregido | FIXED |
| QA-005 | MEDIUM | Pruebas | Casos de catálogo dependían del crecimiento del inventario demo; un texto esperado quedó obsoleto | Ejecutar tests existentes con catálogo ampliado | Fixture acotada y rechazo correcto de pedidos cerrados | Cuatro expectativas de catálogo y un mensaje ya no coincidían; se fijó el conjunto de diez productos de la regresión y el mensaje actual. No se modificó lógica de catálogo para hacer pasar tests | FIXED |
| QA-006 | LOW | Lint / ubicación | Una acción llamada `useCurrentLocation` era interpretada como Hook en callbacks | Ejecutar lint de los controles de ubicación | Acción sin falso error de Rules of Hooks | Alias local `requestCurrentLocation`; misma función y comportamiento | FIXED |
| QA-007 | LOW | Onboarding | Dependencias del callback no representaban el objeto capturado | Lint de `use-mark-store-shared.ts` | Dependencias coherentes | Se usa `business` en la lista de dependencias; no cambia el guardado de progreso | FIXED |
| QA-008 | MEDIUM | Calidad de código | Lint sigue fallando | Ejecutar `npm run lint` | Salida 0 | 23 errores `set-state-in-effect`, 25 errores `refs`; 8 warnings. No equivalen por sí solos a 48 fallos funcionales reproducidos | PENDING |
| QA-009 | MEDIUM | Búsqueda / navegación | Refresh pierde búsqueda y filtros | Buscar PIZZA y recargar Home | Conservar contexto de búsqueda | Navegador confirmó input vacío después de recargar; el estado está sólo en React, sin persistencia en URL | PENDING |
| QA-010 | MEDIUM | Búsqueda | Comparación pública sensible a tildes | Comparar un término acentuado y su variante sin tilde contra texto que sólo contiene una variante | Resultados equivalentes | Revisión estática: `marketplace-pagination.sql` usa `lower`/`strpos`; búsqueda de tiendas usa `ilike`. No hay normalización de acentos en esas comparaciones. Una prueba pareada con fixture acentuada real está NOT TESTED | PENDING, confirmado en código; no validado en SQL desplegado |

### Pendiente de lint

Los errores restantes se distribuyen principalmente en inicializaciones de efectos y lectura de refs durante render, entre otros en Auth, productos, ubicación, PWA, branding, carrito y reserva individual. Las refs del checkout conservan intentos idempotentes: no se reemplazaron indiscriminadamente ni se silenció el chequeo porque hacerlo exige comprobar reintentos, pérdida de respuesta y bloqueo de formularios con una cuenta segura. Los warnings incluyen dependencias de cuatro efectos, navegación mediante location, dos imágenes y una directiva de lint sin regla identificada. No se atribuye al código un bucle de render o una reserva duplicada sin prueba.

## Teléfono, datos personales y demo

- La causa del teléfono señalado era un **placeholder**, no un valor inicial. `emptyBusiness.whatsapp` ya era vacío; editar carga el teléfono guardado o `""`. La normalización +54/+54 9 y la ayuda sin 0 ni 15 no se modificaron.
- Se encontró además el mismo teléfono como dato público guardado de un comercio real al abrir su tienda. Se conservó: eliminarlo hubiera contradicho la instrucción de no borrar datos legítimos. Se omite su valor en este informe.
- `src/data/buyer.ts`: Cliente Demo, ID `comprador-demo`, teléfono ficticio de demo. No se encontró import de este adaptador en una pantalla real actual; se conserva como legacy, no se identifica como dato personal real.
- `src/data/businesses.ts`: comercios ficticios, IDs semánticos y números estadounidenses de la serie reservada 202-555-01xx; los WhatsApp demo siguen advirtiendo que son ficticios.
- `src/lib/stores.ts`: nueve comercios demo, domicilios y horarios ficticios. `src/lib/products.ts`: catálogo simulado y hora fija de referencia. `src/data/requests.ts`, `offers.ts`, `radar-requests.ts`: pedidos/ofertas de prueba con IDs demo y fechas simuladas.
- `DemoProvider` conserva un ID de comercio demo para funcionalidad legacy; su nombre no implica que el catálogo productivo use mocks. Home, Guardados y tiendas actuales cargan productos reales.
- El registro usa un ejemplo numérico genérico diferente del número personal señalado. Los tests nuevos usan datos sintéticos y `example.invalid`; no seed público de compradores reales.
- `supabase/seed.sql` y `category-expansion.sql` contienen categorías, no contactos personales. No se ejecutaron.
- El escaneo de emails literales sólo encontró ejemplos de configuración en `SUPPORT_SETUP.md`, no un email personal hardcodeado en UI. No se eliminaron variables de entorno necesarias.
- No se encontraron tokens/secret keys hardcodeados con los patrones examinados en los archivos públicos de código. No es garantía de una auditoría completa del historial Git ni de los valores configurados en Vercel.

## Rutas y flujos ejecutados

| Área / rutas | Prueba | Resultado / alcance |
|---|---|---|
| `/` | Navegador y HTTP; categorías reales, cards, búsqueda PIZZA, búsqueda sin resultado, limpiar, filtro de distancia deshabilitado sin ubicación | PASS en lectura pública; resultado de PIZZA encontrado, precios y disponibilidad a pedido visibles; sin catálogo demo de fallback |
| `/login` | Formulario y una tentativa con email ficticio `example.invalid` | PASS de error amigable: «Email o contraseña incorrectos.»; login válido NOT TESTED |
| `/registro` | Móvil, labels, checkbox legal obligatorio, botones deshabilitados sin aceptación | PASS de UI/validación previa; no se aceptaron términos ni se creó cuenta |
| `/cuenta`, `/guardados` | HTTP anónimo | PASS: 307 al login; contenido autenticado NOT TESTED |
| `/recuperar-clave` | HTTP / revisión del código | PASS de carga; envío real y respuesta de proveedor NOT TESTED |
| `/restablecer-clave`, `/auth/confirm` | Sin token, tipo inválido y hash ficticio con next externo | PASS: redirects internos, mensaje «Este enlace ya no es válido.»; no se estableció sesión ni se cambiaron contraseñas |
| `/comercio` | HTTP | 200 público de entrada; workspace depende de Auth/negocio; no implica permiso de escritura |
| `/comercio/crear`, `/comercio/editar`, `/comercio/mi-negocio` | HTTP y revisión de formulario | PASS de protección anónima; creación/edición real NOT TESTED |
| `/comercio/productos`, `/nuevo`, `/[id]/editar` | HTTP y revisión de render compartido | PASS de protección; banner Demo local sólo se renderiza bajo `/demo/`; CRUD real NOT TESTED |
| `/comercio/radar`, `/comercio/reservas`, `/reservas`, `/pedidos`, `/pedido/nuevo` | HTTP anónimo | PASS: redirigen al login; resultados/acciones autenticadas NOT TESTED |
| `/admin`, `/admin/analitica`, `/admin/comercios`, detalle de comercio, `/admin/productos`, `/admin/usuarios`, detalle de usuario, `/admin/pedidos`, detalle de pedido, `/admin/reportes`, `/admin/auditoria` | HTTP anónimo, listado de rutas del build y revisión server-side | PASS de rechazo anónimo; redirects del layout vuelven a `/admin`. Lecturas Admin reales y rechazo de usuario normal autenticado NOT TESTED |
| `/tienda/[slug]` real | Navegador, desde card/producto | PASS de logo, portada, localidad, descripción, cuatro productos activos, precios, entrega, enlace al detalle y badge Verificado; filtro interno PIZZA deja un producto |
| Modal de verificación pública | Abrir y cerrar | PASS: explicación, foco en cerrar y cierre operativo. No se alteró verificación |
| `/producto/[id]` real | Navegación desde Home | PASS: nombre, foto, precio, ON_DEMAND, WhatsApp guardado y enlace a tienda |
| `/carrito`, `/carrito/[businessId]` | Carrito local con productos públicos reales | PASS: agregar pizza, subir cantidad a dos y agregar milanesa; subtotal 42.000 ARS. Carrito conservado al recargar y navegar. No se envió pedido |
| `/carrito/[businessId]/checkout` | Continuar anónimo | PASS: login con retorno al checkout; formulario autenticado NOT TESTED |
| `/contacto` | Formulario móvil y API negativa | PASS de carga/labels, origen y tamaño; éxito con persistencia, email y rate limit real NOT TESTED |
| `/privacidad`, `/terminos`, `/reglas-comercios` | HTTP y links de footer | PASS, 200; no auditoría jurídica |
| `/comercios/ferreteria-norte` | HTTP y navegador | PASS: 404 normal, sin redirects ni demo |
| `/demo/comercios/ferreteria-norte` | HTTP y navegador | PASS: demo explícita y catálogo ficticio; no desde links de productos Supabase |
| `/tienda/qa-tienda-inexistente` y ruta arbitraria inexistente | HTTP | PASS: 404 |
| Producto UUID sintético inexistente | HTTP | 200 con estado no disponible, decisión existente; no fallback demo |
| Manifest, sw.js, iconos 192 y 512 | HTTP y revisión de archivos | PASS de disponibilidad; instalación efectiva en dispositivo NOT TESTED |

El barrido HTTP cubrió también versiones con UUID sintético de edición de producto, carrito y checkout. Las pantallas privadas con sesión no se presentan como probadas sólo porque redirigieron correctamente.

### API de Contacto: pruebas sin efectos externos

| Caso | Estado observado |
|---|---:|
| Origin externo | 403 |
| Content-Type incorrecto | 415 |
| JSON malformado | 400 |
| Campos incompletos | 400 |
| Honeypot rellenado | 200, rama anterior a Auth/RPC/email |
| Cuerpo de 17.000 bytes | 413 |

## Revisiones de seguridad y lógica (estáticas, no certificación remota)

- **Auth/SSR:** callbacks usan cliente SSR/cookies, `verifyOtp({ token_hash, type })` con allowlist y redirects internos; recovery no usa exchangeCodeForSession. Signup/Google reutilizan `/auth/confirm`. Un hash vencido/reutilizado válido originalmente y la sesión cross-device requieren email/cuenta de prueba: NOT TESTED.
- **Consentimiento:** checkbox 18+/términos/privacidad obligatorio; registro Google exige aceptación en pantalla de registro; login Google de usuario nuevo queda sujeto a LegalAcceptanceGate y aceptación RPC. Verificado por código, no con nuevo usuario OAuth.
- **Admin:** layout y páginas requieren sesión y `is_admin`; RPC exige `private.require_admin()`. Se mantienen logs técnicos server-side con redacción. No se pudo cargar Analítica ni verificación como Admin: no se declara corregido en producción ni se asume falta de migraciones.
- **Analítica:** argumentos TS y SQL coinciden, períodos 7/30/90, minimum 1/2/3, páginas y localidad acotados; consumición por UUID se arma con búsqueda explícita, no por render/tecla/paginación. Registro remoto y conteos: NOT TESTED. El delta existente `admin-runtime-fixes.sql` corrige la incompatibilidad STABLE/FOR SHARE; estado desplegado no comprobado.
- **Verificación:** lectura SQL parte del comercio y LEFT JOIN al evento; false/sin eventos admite metadatos null. Constraint histórico permite BUSINESS_VERIFIED/UNVERIFIED. Cambiar, quitar, auditar y verificar nuevamente: NOT TESTED.
- **Suspensiones:** SQL impide suspender usuarios con PENDING vigente, CONFIRMED o READY como comprador o propietario. Guardas de escritura y policies restrictivas de Storage revisadas. Su instalación y ejecución actuales no se verificaron en Supabase.
- **Storage:** `product-storage.sql` y `business-store-branding.sql` definen propiedad de imágenes; Fase2 añade restricciones INSERT/UPDATE/DELETE para suspendidos, sin bloquear lectura pública. Subir/reemplazar/eliminar con usuario activo/suspendido: NOT TESTED.
- **Imágenes:** validación JPEG/PNG/WebP, límites de archivo, compresión con canvas y liberación de Object URLs; portada preparada 4:1 y logo cuadrado con ajuste. Procesamiento y preview del comerciante: NOT TESTED.
- **Reservas multiproducto:** funciones SQL tienen intentos UUID, comparación de reintentos, snapshots, locks y stock al confirmar. ON_DEMAND omite descuento numérico; cancelación devuelve stock según marcador. PENDING→CONFIRMED→READY→COMPLETED/CANCELLED y expiración: NOT TESTED en base de datos. Pruebas demo no sustituyen esto.
- **Radar/pedidos abiertos:** coordenadas en requests con RLS restrictiva de lectura; proyección Radar sin coordenadas privadas, Haversine en PostgreSQL y radio al crear oferta. El código Realtime usa aviso/reconsulta; carrera de ofertas, radios 5/10 y expiración: NOT TESTED con cuentas.
- **Reportes:** unique parcial OPEN y rate limit SQL; permisos Admin y auditoría, sin suspensión automática. Creación/resolución/descartado: NOT TESTED.
- **Soporte:** listados Admin seleccionan datos generales; contacto/dirección se seleccionan en detalles autorizados. No se abrió historial privado ni se exportaron datos de personas.
- **Secretos:** SUPABASE_SECRET_KEY, RESEND_API_KEY y CONTACT_RECIPIENT_EMAIL aparecen en el módulo `server-only` de soporte; no se encontraron sus valores en los assets públicos compilados. La public key de Supabase y Geoapify NEXT_PUBLIC son configuración pública por diseño.
- **PWA:** sólo cinco assets públicos en caché; Auth/API se excluyen, RPC de origen Supabase pasa directo, navegación usa red sin almacenar documentos, fotos/precios/stock no se cachean en el SW. No hubo simulación offline ni instalación: NOT TESTED.
- **SEO:** titles/descripciones, manifest e iconos existen; no se verificaron DNS, remitente, Redirect URLs/Site URL, canonical ni deployment en cercaya.com.ar. Las páginas demo siguen accesibles explícitamente; considerar noindex antes de permitir indexación pública, decisión pendiente fuera de correcciones funcionales.

## Responsive, accesibilidad, consola y network

- Home: tres viewports solicitados, sin overflow horizontal del documento en las mediciones. Mapa oculto en mobile y categorías con scroll. Se capturaron vistas de Home móvil/tablet en la sesión.
- Registro: labels en inputs, checkbox legal required, botones sin aceptación deshabilitados y sin overflow a 390 px.
- Tienda: logo/portada y catálogo, filtro y modal de badge sin overflow a 390 px.
- Carrito: cantidad, sugerencias y resumen sin overflow a 390 px. Lectura de carrito al recargar tiene estado transitorio de carga antes del catálogo.
- Footer/legal: enlaces visibles en snapshots y rutas 200; Contacto se carga en móvil. No se auditó WCAG completo ni contraste con instrumental.
- Admin autenticado, tablas privadas, editor/branding, QR comerciante y checkout autenticado a los tres tamaños: NOT TESTED, falta sesión segura.
- Consola observada: sin errores de React/hydration en las interacciones públicas ejecutadas; un warning de prioridad LCP de una imagen demo en dev. Los logs del navegador son evidencia parcial, no certificación de toda la app.
- Logs del servidor final: dos avisos «The destination stream closed early» durante el barrido que cancelaba deliberadamente los cuerpos HTTP después de leer estado/headers. Se registran; no se reprodujo una pantalla rota asociada ni se clasifican automáticamente como fallo de negocio.
- Network: estados y caché de rutas/API verificados vía HTTP local. Las lecturas públicas Supabase se confirmaron por datos reales cargados en UI. No se inspeccionaron headers con tokens ni se contó tráfico RPC por tecla con un monitor de red; esa parte queda revisión estática/NOT TESTED.

## Registro de correcciones y archivos

| Archivo | Corrección |
|---|---|
| `src/components/businesses/business-form.tsx` | Placeholder genérico de WhatsApp; creación vacía y edición con datos legítimos conservadas. |
| `src/components/reservations/reservation-checkout-fields.tsx` | Placeholder genérico del teléfono de comprador. |
| `src/app/api/contacto/route.ts` | JSON malformado devuelve 400; el resto del procesamiento permanece. |
| `src/lib/reservation-checkout.ts` | Validación de claves propias para método de pago. |
| `src/components/location/buyer-location-controls.tsx` | Alias de acción para no confundirla con Hook. |
| `src/components/requests/request-location.tsx` | Mismo alias, sin cambiar consentimiento/geolocalización. |
| `src/components/onboarding/use-mark-store-shared.ts` | Dependencias del callback coherentes con objeto capturado. |
| `tests/request-domain.test.mjs` | Resolver alias y expectativa del error de pedido cerrado. |
| `tests/catalog.test.mjs` | Fixture acotada de diez productos para regresión. |
| `tests/qa-release.test.mjs` | Siete pruebas puras de validaciones/seguridad/onboarding/availability. |
| `QA_RELEASE_REPORT.md` | Este informe. |

No se modificó SQL ni RLS. No se creó un delta nuevo. El delta Admin previo no se reescribió ni se ejecutó; comprobarlo con una sesión Admin y logs, no volver a asumir que faltan business-analytics/business-verification. El ajuste de acentos necesitaría diseñar y revisar un delta de lectura, no ejecutar ni editar SQL histórico durante esta revisión.

## Orden breve para cerrar

1. Resolver lint sin silencios, verificando especialmente las refs de reintentos de checkout con pruebas seguras.
2. Acordar persistencia de búsqueda y normalización de tildes; corregir esas dos limitaciones y agregar regresiones con datos acentuados.
3. Completar QA en un entorno descartable con comprador, comerciante y Admin: registro/legal/Google, recovery cross-device, CRUD+Storage, onboarding, pedidos+stock y cancelación, Radar, suspensiones/reportes, Analítica y verificación. Todos estos casos están NOT TESTED; no se extrapola desde el catálogo público.
4. Verificar emails reales mínimos, Redirect URLs del dominio, PWA en dispositivo y responsive de pantallas privadas; revisar Vercel Logs para RPC Admin si falla.
5. Repetir validaciones después de esos cambios y actualizar este informe antes de declarar READY FOR BARRIAL BETA.


## SEGUNDA PASADA QA

Reanudada el 10 de octubre de 2026, America/Buenos_Aires. Esta sección actualiza la primera pasada conservada arriba. La conclusión histórica basada en lint limpio se sustituye por evaluación de riesgo real al finalizar.

### Estado recuperado antes de continuar

- TypeScript y build PASS; tests 24/24 PASS. Lint: 48 errores/8 warnings al iniciar; 46 errores/5 warnings después de correcciones locales.
- QA-009 FIXED / RETESTED / PASS: URL conserva término, categoría, filtros, orden y página. Navegador confirmó pizza + Con envío + Menor precio tras refresh a 1366×768 y 390×844. Sin coordenadas en URL ni evento por restauración.
- QA-010 FIXED en código; delta search-accent-normalization.sql reutiliza private.normalize_search_query en productos y búsqueda pública de tiendas. Aplicación manual confirmada por el usuario al reanudar; retest remoto pendiente.
- Panel, onboarding, edición de comercio (lectura), QR móvil, producto QA con imagen, STOCKED→ON_DEMAND, desactivación/reactivación: PASS. Comercio autorizado por el usuario: Lomos 24 hs (nombre mostrado Lomiteria 24 hs). Sus cuatro productos originales se conservaron intactos.
- Producto creado en esta segunda pasada: [QA] Café jabón segunda pasada 20261009; ID 385bf7de-b1d0-4ff9-b0cd-55066b81aa78. Imagen de prueba: icono público de la app. Se reactivó para probar pedido; estado al corte activo. Debe quedar inactivo al finalizar.
- Pedido de esta ejecución: d1c75b0c-a87d-4b00-bcf7-ecad283b7c90, producto QA, una unidad, retiro, total ARS 100, pago ARRANGE, nombre de contacto [QA] Segunda pasada. Creación PENDING PASS; carrito se vació tras creación. La misma cuenta actuó como comprador y propietario; NO equivale a prueba entre dos cuentas.
- Al corte se había abierto la gestión comercial de ese pedido PENDING; confirmar→READY→COMPLETED aún no ejecutado. No se procesó dinero.
- Usuario comerciante no Admin → /admin redirige a Home: PASS. Sesión Admin y comercio descartable para cambios de verificación todavía pendientes de confirmación.
- Compatibilidad de navegación móvil a Buscar/Guardados desde DetailShell/RequestShell adaptada a view en URL; cambio posterior al build previo. Retest y build final pendientes.
- Escaneo anterior de esta segunda pasada: teléfono personal hardcodeado PASS; SUPABASE_SECRET_KEY / RESEND_API_KEY / CONTACT_RECIPIENT_EMAIL en 61 assets cliente PASS, sin valores impresos.

### Pruebas restantes

SQL sin tildes, conteos Analytics antes/después de refresh, rutas Admin, verificación de comercio QA, comprador separado, pedido entre cuentas, reportes/contacto autenticado, cleanup y validaciones finales. NO se ejecuta SQL remoto ni se inventan credenciales. Resultados se agregarán aquí, sin repetir los PASS ya documentados.

### Lint: clasificación final por archivo y regla

A: errores introducidos por las correcciones QA: 0 en el chequeo actual. B: errores presentes en HEAD antes de QA (deuda legacy): 46. C: warnings: 5. Se compararon las líneas con HEAD; no se cambiaron reglas ni se agregaron silencios.

| Archivo | Regla | Posiciones línea:columna (multiplicidad) | Clase | Motivo de conservación |
|---|---|---|---|---|
| src/components/auth/account-suspension-notice.tsx | react-hooks/exhaustive-deps | 26:6 | C | Efecto captura user pero depende de user.id; misma identidad. No alterar Auth para silenciar el warning. |
| src/components/auth/account.tsx | @next/next/no-location-assign-relative-destination | 26:7 | C | Recarga de logout deliberada para invalidar estado/prefetch. No alterar Auth. |
| src/components/auth/auth-provider.tsx | react-hooks/set-state-in-effect | 28:20 | B | Inicialización de Auth/recovery; no refactor automático del flujo sensible. |
| src/components/auth/saved-products.tsx | react-hooks/set-state-in-effect | 13:21 | B | Inicialización de Auth/recovery; no refactor automático del flujo sensible. |
| src/components/businesses/business-form.tsx | react-hooks/set-state-in-effect | 55:20 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/businesses/business-provider.tsx | react-hooks/exhaustive-deps | 49:29 | C | revision.current es contador de solicitudes, no ref DOM; cleanup invalida la revisión vigente. Capturar el valor viejo cambiaría la cancelación. |
| src/components/businesses/my-business.tsx | react-hooks/set-state-in-effect | 36:20 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/cart/cart-checkout.tsx | react-hooks/refs | 74:34 | B | Refs de intentos/bloqueo idempotente durante render. Reemplazarlas exige validar reintentos y respuestas perdidas; sin refactor sensible automático. |
| src/components/cart/cart-checkout.tsx | react-hooks/set-state-in-effect | 84:20 | B | Inicialización/recuperación de pedido sensible; revisar con escenarios de interrupción antes de refactor. |
| src/components/cart/use-cart-catalog.ts | react-hooks/set-state-in-effect | 18:5 | B | Inicialización/recuperación de pedido sensible; revisar con escenarios de interrupción antes de refactor. |
| src/components/details/stock-time.tsx | react-hooks/set-state-in-effect | 7:21 | B | Reloj posterior a hidratación evita discrepancia SSR; no se probó fallo funcional. |
| src/components/location/user-location-provider.tsx | react-hooks/set-state-in-effect | 31:7 | B | Restaura ubicación de sesión; cambio de inicialización exige validar SSR/consentimiento. |
| src/components/merchant-products/product-form.tsx | react-hooks/set-state-in-effect | 27:20 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/merchant-products/product-list.tsx | react-hooks/set-state-in-effect | 37:20 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/merchant-products/product-photo-input.tsx | react-hooks/set-state-in-effect | 20:18 | B | Ciclo de vida de Object URLs/previews; conservar liberación y validar reemplazo/Deshacer antes de refactor. |
| src/components/pwa/pwa-provider.tsx | react-hooks/set-state-in-effect | 31:5 | B | Detección de plataforma/instalación después de hidratar; no cambiar flujo PWA. |
| src/components/requests/buyer-request-data.tsx | react-hooks/set-state-in-effect | 27:10 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/requests/buyer-request-data.tsx | react-hooks/exhaustive-deps | 30:29 | C | revision.current es contador de solicitudes, no ref DOM; cleanup invalida la revisión vigente. Capturar el valor viejo cambiaría la cancelación. |
| src/components/requests/new-request.tsx | react-hooks/set-state-in-effect | 41:20 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/requests/use-account-data.ts | react-hooks/set-state-in-effect | 42:10 | B | Inicialización/carga por identidad y cancelación; no se demostró bucle o fallo funcional. Refactor fuera de alcance local. |
| src/components/requests/use-account-data.ts | react-hooks/exhaustive-deps | 45:29 | C | revision.current es contador de solicitudes, no ref DOM; cleanup invalida la revisión vigente. Capturar el valor viejo cambiaría la cancelación. |
| src/components/reservations/reservation-form.tsx | react-hooks/refs | 66:18, 66:26, 70:198 ×8, 70:415 ×8, 71:279 ×5, 75:117 | B | Refs de intentos/bloqueo idempotente durante render. Reemplazarlas exige validar reintentos y respuestas perdidas; sin refactor sensible automático. |
| src/components/stores/merchant-store-card.tsx | react-hooks/set-state-in-effect | 20:21 | B | Origen/capacidades del navegador después de hidratación; render extra acotado, sin fallo observado. |
| src/components/stores/store-asset-input.tsx | react-hooks/set-state-in-effect | 25:18 | B | Ciclo de vida de Object URLs/previews; conservar liberación y validar reemplazo/Deshacer antes de refactor. |
| src/components/stores/store-branding-preview.tsx | react-hooks/set-state-in-effect | 17:5 | B | Ciclo de vida de Object URLs/previews; conservar liberación y validar reemplazo/Deshacer antes de refactor. |
| src/components/stores/store-share.tsx | react-hooks/set-state-in-effect | 13:21 | B | Origen/capacidades del navegador después de hidratación; render extra acotado, sin fallo observado. |
| src/components/stores/store-slug-editor.tsx | react-hooks/set-state-in-effect | 41:5 | B | Debounce/disponibilidad con cancelación; no alterar lógica de URL en QA. |
| src/components/support/password-support.tsx | react-hooks/set-state-in-effect | 16:20 | B | Inicialización de Auth/recovery; no refactor automático del flujo sensible. |


### Retest al reanudar — 10 de octubre

- SQL de búsqueda aplicado manualmente: confirmado por el usuario. No ejecutado por el agente.
- QA-010 RETESTED / PASS en base real a través de UI: jabon/jabón, cafe/café/CAFÉ, panaderia/panadería → mismo producto QA. Nombre y descripción probados; cafeteria → marca Cafétería QA; edicion → modelo Edición QA. No se descargó catálogo completo ni se filtró en frontend.
- search_public_stores PASS: búsqueda lomiteria devuelve tienda real, categorías, localidad y opciones de entrega, sin el error de carga previo a aplicar el delta. No se añadió catálogo paralelo.
- Consola en estos casos: sin errores/warnings registrados; datos cargados por RPC reales. No certifica tráfico de otras rutas.
- Final técnico del working tree actual: npx tsc --noEmit PASS (salida 0), npm run build PASS (salida 0, 39 páginas estáticas), npm test PASS (24/24), npm run lint FAIL (46 errores, 5 warnings). Son chequeos solicitados del código final, no repetición de las pruebas UI aprobadas.
- Lint restante: deuda legacy/potencial de renders extra, no se demostró fallo importante. Las refs de checkout y la recuperación ante respuestas perdidas no se refactorizan automáticamente. La conclusión no exige lint cero.
- Persistencia móvil Buscar/Guardados desde otras pantallas: cambio ya incluido en build final; prueba UI específica pendiente.
- Admin, conteo Analytics/refresh, segundo comprador, verificación y cierre del pedido QA: pendientes de sesión/datos autorizados.


### Evidencias adicionales de la reanudación

- Pedido QA del corte: lectura de comprador muestra Vencido, sin controles de confirmación/cancelación y con snapshot de una unidad ON_DEMAND, subtotal/total ARS 100, retiro y ARRANGE conservados. No se intentó confirmar un pedido vencido ni modificar su estado mediante SQL. Prueba entre dos cuentas sigue NOT TESTED.
- Retest de ajustes de navegación posteriores al build anterior: RequestShell→Buscar da /?view=search; Home→Guardados da /?view=saved; DetailShell→Guardados da /?view=saved#catalogo. PASS a 390×844. Viewport restaurado.
- Escaneo del build final: SUPABASE_SECRET_KEY PASS; RESEND_API_KEY PASS; CONTACT_RECIPIENT_EMAIL PASS; teléfono personal hardcodeado en src/public PASS. Valores no impresos.
- No se encontraron bugs nuevos confirmados en las pruebas reanudadas hasta este checkpoint. No se modificó código al reanudar; sólo el informe.

### Admin QA y Analytics — sesión confirmada

- PASS UI real: /admin, /admin/analitica, /admin/comercios, /admin/comercios/[id], /admin/productos, /admin/usuarios, /admin/usuarios/[id], /admin/pedidos, /admin/pedidos/[id], /admin/reportes y /admin/auditoria. Detalles usados: comercio autorizado Lomiteria 24 hs, propia cuenta Admin QA y pedido [QA] D1C75B. No apareció «No pudimos abrir esta sección».
- Verificación actual: comercio verificado, fecha y Admin visibles; auditoría muestra BUSINESS_VERIFIED. No se alteró estado. Sólo existe ese comercio; autorización del ciclo reversible solicitada y pendiente.
- Analytics PASS: baseline 3 búsquedas (pizza 2, taladro 1). Buscar explícito cafe → total 4, cafe 1 con resultado. Navegar a la búsqueda persistida y refresh → total 4, cafe 1. Refresh no crea evento adicional.
- Consola Admin consultada: sin errores/warnings registrados. Reportes vacío es estado válido; detalle Admin muestra pedido QA vencido, snapshot y timeline correctos, sólo lectura.

### Ciclo de verificación autorizado — 10 de octubre

- Usuario autorizó temporalmente Lomiteria 24 hs. Estado inicial verificado. Quitar verificación con motivo Otro y nota [QA] → No verificado, sin excepción ni fecha/Admin históricos mostrados como actuales. Verificar nuevamente → Verificado, fecha actual y Admin QA correctos. Estado original restaurado.
- Auditoría PASS: aparecen BUSINESS_UNVERIFIED y BUSINESS_VERIFIED, notas [QA], motivo y administrador; historial anterior conservado. No se suspendió el comercio ni se alteraron productos/pedidos.
- Sesión vigente al cerrar este checkpoint: todavía Admin QA. El usuario confirmó que cambiará a compradora QA; cambio aún no observado. Pedido entre cuentas pendiente, no certificado.
- Tienda pública tras restauración: badge Verificado visible y catálogo de 5 productos (4 originales + producto [QA]) intacto. PASS. El producto [QA] debe desactivarse después de la prueba entre cuentas.

### Comprador separado autorizado — pedido entre dos cuentas

- Usuario autorizó usar Admin QA como comprador. Identidad distinta del dueño del comercio, comprobada previamente en cuenta/Admin. No se asumió acceso de otra cuenta.
- Producto [QA] 385bf7de-b1d0-4ff9-b0cd-55066b81aa78 → carrito 1 unidad → checkout retiro gratis, ARRANGE → pedido real 1617023e-7a43-4ae4-a44b-5e3b9f892543, PENDING. Total/snapshot ARS 100, ON_DEMAND, contacto ficticio [QA] Comprador Admin segunda pasada. No se alteró perfil ni se realizó cobro.
- Carrito vacío después de envío. Detalle comprador muestra snapshot, total, modalidad, pago y timeline PENDING. Contacto del comercio no aparece en el detalle del pedido pendiente (el contacto público de la tienda existe independientemente).
- Próximo paso: sesión dueño Lomiteria 24 hs para CONFIRMED → READY → COMPLETED. No declarar PASS end-to-end hasta completar ambos lados. Pedido nuevo vence a los 30 minutos; si vence, no forzar estados. Producto [QA] permanece activo hasta concluir y debe desactivarse.

### Pedido entre dos cuentas — avance y limpieza

- Cuenta dueña del comercio accedió al pedido 1617023e-7a43-4ae4-a44b-5e3b9f892543 creado por Admin comprador. PENDING → CONFIRMED → READY → COMPLETED PASS por UI, sin pagos. Cada transición comprobada; snapshot, total ARS 100, retiro y ARRANGE se mantuvieron. Contacto comprador oculto antes de confirmación y visible después. Timeline con las cuatro fechas/estados.
- Historial comerciante PASS: pedido nuevo completado y pedido QA previo vencido; 0 pendientes. Pedidos originales no modificados.
- Modalidad probada ON_DEMAND: preparación no descuenta inventario numérico; no certifica decremento de STOCKED entre cuentas en esta prueba.
- Limpieza PASS: producto QA desactivado desde cuenta dueña; catálogo público vuelve a exactamente los 4 originales intactos. Registro/imagen QA conservados para historial, no borrados. Comercio conserva verificación.
- Falta consultar historial/detalle final desde la cuenta compradora separada para cerrar ambas perspectivas. Pedido Abierto/oferta/reporte/contacto autenticado siguen pendientes de ejecución; no asumir PASS por lectura de código.

### Comprador final y soporte — 10 de octubre

- Historial comprador separado /reservas PASS: único pedido #161702 COMPLETED; detalle y timeline completos, snapshot ARS 100 intacto después de desactivar producto. Flujo entre dos cuentas PASS para ON_DEMAND, retiro y ARRANGE. No certifica STOCKED ni todas las combinaciones de entrega/pago.
- Pedido Abierto [QA] Oferta de prueba segunda pasada creado sin ubicación, categoría Gastronomía, radio solicitado 5 km, estado OPEN: ca4a54e4-67af-48cb-b3bc-e6a0ed1aaf66. Confirmación correcta. Debe recibir oferta y cancelarse al finalizar; no generó coordenadas de prueba.
- Reporte autenticado PASS: comercio autorizado, Otro, comentario [QA]; registro b10ec56e-1404-42e2-8c03-a0d238a8f5d9 visible en Admin. Descartado con nota [QA], sin suspensión/moderación del comercio. Navegación client-side al detalle inicialmente volvió al listado; navegación completa al href observado abrió correctamente. Incidente no reproducido todavía, no atribuir causa sin prueba.
- Contacto autenticado PASS en UI: mensaje [QA] → Recibimos tu consulta; sin errores/warnings de consola. No se verificó recepción de email en buzón externo, no afirmar entrega del proveedor.
- Radar comerciante PASS: Pedido Abierto QA visible por categoría, Distancia no disponible y filtros de distancia deshabilitados correctamente al no compartir ubicación.
- Oferta QA enviada desde dueño Lomiteria 24 hs: título [QA], ARS 100, retiro/envío gratis, descripción y tiempo marcados [QA], confirmación Mi oferta / Pendiente. Falta lectura comprador y cancelación del Pedido Abierto para limpieza. No aceptar oferta ni preparar entrega real.


### Cierre funcional de la segunda pasada — 10 de octubre

- Oferta recibida PASS: e6be5739-96f7-42fa-9bc7-850392f199a8 visible desde comprador con precio ARS 100, retiro/envío y descripción QA. Publicación y lectura entre dos cuentas reales comprobadas; no se acepta oferta ni se crea reserva adicional. No se certificó llegada instantánea por Realtime porque hubo cambio de sesión y navegación.
- Limpieza Pedido Abierto PASS: ca4a54e4-67af-48cb-b3bc-e6a0ed1aaf66 cancelado por comprador, confirmación visible, sin controles de cierre/cancelación posteriores. Oferta conserva estado histórico Pendiente; no se asumió que deba cambiar automáticamente. No queda oportunidad abierta QA por ese pedido.
- Logout PASS: cuenta Admin comprador cerró sesión, Home mostró Iniciar sesión, /reservas redirigió al login. No se inventaron credenciales; login exitoso fue manual por el usuario y su sesión se comprobó por acceso autorizado.
- Estado de limpieza: producto QA inactivo; cuatro productos originales públicos intactos; comercio verificado; pedido QA anterior vencido; pedido entre cuentas completado; Pedido Abierto QA cancelado; reporte QA descartado; consulta QA enviada sin necesidad de respuesta. No se borraron datos ni imágenes, registros QA preservados como historial.
- Incidente de enlace de reporte: no se reprodujo al navegar directamente al href; posible estado de navegación/sesión durante cambios de cuenta, causa no demostrada. LOW de observación; probar nuevamente en una sesión estable al desplegar, sin corrección especulativa.


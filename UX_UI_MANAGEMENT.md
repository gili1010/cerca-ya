# CercaYa — UX/UI 8: paneles de gestión

## Alcance y auditoría inicial

Trabajo realizado sobre el working tree existente, sin revertir UX/UI 4–7. Se revisaron git status/diff, rutas, componentes, contratos de presentación y documentación UX_UI_GUIDELINES, HOME, SEARCH, DETAILS, PUBLISH, ACTIVITY_ACCOUNT y RADAR. También BUSINESS_SETUP, PRODUCT_SETUP, PRODUCT_STORAGE_SETUP, PERSONAL_LISTINGS_FRONTEND, SERVICES_FRONTEND y RESERVATION_SETUP. Se consultó la guía instalada de Next.js sobre componentes de servidor/cliente.

Revisión exclusivamente por lectura. No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni despliegues. No hay PASS de ejecución ni validación visual realizada. No se modificaron datos reales ni se instalaron dependencias.

### Mapa real

| Dominio | Rutas existentes | Implementación |
| --- | --- | --- |
| Comercio | /comercio | MerchantWorkspace, PublishedProductsLink, MerchantOnboarding, MerchantStoreCard |
| Datos y tienda | /comercio/mi-negocio, /comercio/editar | MyBusiness, BusinessForm, branding y horarios existentes |
| Productos | /comercio/productos, /comercio/productos/nuevo, /comercio/productos/[id]/editar | MerchantProductList, MerchantProductForm, ProductPhotoInput, StockConfirmation, MerchantBusinessGate |
| Pedidos recibidos | /comercio/reservas, /comercio/reserva/[id] | ReservationList business, ReservationDetail business, snapshots y timeline existentes |
| Artículos | /mis-publicaciones, /mis-publicaciones/[id], /mis-publicaciones/[id]/editar | MyListings, ListingActions, ListingActionConfirmation, editor de cuatro pasos |
| Profesional | /mi-perfil-profesional | ProfessionalProfile, ServiceAreasEditor, ServicePhotos |
| Servicios | /mis-servicios, /mis-servicios/[id], /mis-servicios/[id]/editar | MyServices, ServiceCard owned, ServicePresentation, editor existente |

Header, MobileNav, ActivityMenu y Cuenta ya proporcionan accesos agrupados. RequestShell mantiene secciones comerciales y PersonalShell conserva la navegación compartida. No se crea otro dashboard global, otro menú de roles ni otra pantalla para recursos existentes.

### Problemas encontrados

- Las operaciones frecuentes del comercio estaban después del onboarding y del bloque de tienda; había una tarjeta sin acción de Estadísticas próximamente.
- Tipografía administrativa de productos de 11–12 px y tres columnas estrechas en escritorio; botones con textos largos comprimidos en móvil.
- Artículos y servicios reutilizaban tarjetas públicas sin un tratamiento administrativo acotado. La condición del artículo no se veía en el listado propio.
- Mis servicios no mostraba en la tarjeta propia el resumen de cobertura ni una aclaración adicional de la modalidad de precio.
- Los pedidos recibidos mostraban el UUID completo en cada tarjeta; el identificador completo ya está disponible en el detalle.
- El formulario comercial necesitaba más separación, clasificación de opcionales y una zona de foto reconocible.

## Panel comercial

Las operaciones existentes se ubican antes del onboarding y personalización. Se conserva el contador real de PublishedProductsLink. Se añade un acceso a la ruta existente Agregar producto y otro a Configurar comercio; se mantiene Radar y Reservas. Se retira únicamente la tarjeta decorativa de Estadísticas, sin quitar operaciones implementadas. La navegación de RequestShell no se modifica.

Se muestra la localidad del comercio ya cargado, el nombre real, avisos de inactividad/suspensión y verificación existente. Ver mi comercio queda como acción secundaria; MerchantStoreCard mantiene Ver tienda pública, copiar, compartir y QR sin cambios. No se inventan métricas de ventas o pagos.

## Productos, stock y disponibilidad

Listado administrativo de hasta dos columnas amplias, una en móvil. Fotos administrativas cuadradas existentes con contain; nombre, precio, categoría, publicación y disponibilidad separados. Metadatos de 13–14 px y acciones de al menos 44 px. Editar producto se identifica explícitamente; las acciones inferiores conservan su alineación mediante flex.

La etiqueta Publicado/Despublicado representa exclusivamente active, no garantiza visibilidad ante suspensión del comercio, ubicación o filtros públicos. El aviso de bloqueo administrativo se conserva.

STOCKED muestra cantidad y estado real. ON_DEMAND muestra preparación informada para hoy, sin inventar unidades ni equipararla a stock inmediato. La fecha de confirmación sigue en StockConfirmation. No se cambian las reglas today/confirmed, cálculos ni filtros públicos.

No se agrega edición rápida de precio/stock: el listado conserva confirmar stock/disponibilidad y activar/desactivar; los cambios de cantidad/precio siguen pasando por Editar producto y Guardar. manage_my_product y su respuesta se conservan.

## Formulario e imágenes comerciales

Se conserva un solo formulario y su submit, validaciones, datos escritos, savedId, bloqueo en vuelo, estados de procesamiento, subida/registro y limpieza explícita. Se mejora padding, ritmo entre campos, fieldsets, contraste y ancho de controles. Nombre, categoría, precio y cantidad se identifican como obligatorios según atributos existentes; descripción, marca, modelo, SKU y foto se señalan como opcionales.

La fotografía principal utiliza el control existente: seleccionar, reemplazar, quitar y deshacer. Vista previa administrativa de hasta 280 × 200 px con contain, sin deformar ni cambiar compresión, límites, URLs, Storage o permisos. Sólo existe una foto principal administrable en este formulario; no se inventan galería ni reordenamiento.

## Pedidos y reservas del comercio

Listado en dos columnas amplias o una en móvil, estados reales, cantidad total, importe, entrega y fecha existentes. Identificador corto Pedido #XXXXXX; el detalle conserva identificador completo. Las acciones de tarjeta siguen llevando al detalle autorizado.

El detalle comercial incorpora espacio superior y antes del encabezado, metadata legible, foco visible y botones cómodos. Se conserva el resumen multiproducto, snapshots, cantidades, pago acordado, timeline y siguiente paso según estado. Ninguna reserva se presenta como venta pagada.

PENDING, CONFIRMED, READY, COMPLETED, CANCELLED y EXPIRED siguen derivados de reservationDisplay. No se cambian transiciones, expiración, descuento/devolución de stock, cancelación, rechazo ni Realtime. Se conserva el diálogo de cancelación y sus consecuencias reales. El rechazo PENDING existente continúa siendo una acción directa: añadir otra confirmación requeriría evaluar ese cambio de interacción explícitamente, no se reemplaza su handler.

## Mis artículos

Tarjetas propias con miniatura administrativa de 160 px de alto y contain, título, precio, condición Nuevo/Usado, localidad, fecha y estado real. Los filtros y la paginación remotos existentes permanecen. Acciones distribuidas con separación, área táctil y ancho completo en móvil.

ListingActions conserva sus condiciones de edición, publicación, pausa, vendido y retiro; SOLD/WITHDRAWN no se convierten en editables. Se conservan los diálogos existentes, revisiones y relecturas. No se rehace el editor de cuatro pasos ni se añade carrito a particulares.

## Perfil, servicios y cobertura

Mi presentación, Cómo pueden contactarme, Dónde trabajo y foto opcional conservan sus formularios/guardados reales, con jerarquía y texto más legibles. No se divide el guardado de perfil ni se crea un formulario duplicado.

La cobertura se comparte entre todos los servicios; el texto explica su uso para encontrar trabajos compatibles. Se mantienen chips existentes, máximo 30, provincias/localidades y deduplicación normalizada. Localidad de referencia no equivale a cobertura ni a domicilio privado; no se usa GPS ni se agregan áreas automáticamente.

Mis servicios conserva filtros y páginas de 24, estados DRAFT/PUBLISHED/PAUSED/WITHDRAWN y límite de 20 no retirados. Las tarjetas propias muestran cobertura resumida de datos ya cargados, modalidad y aceptación de consultas; pueden existir sin fotografías. FIXED se aclara como precio fijo, FROM como importe inicial variable y QUOTE como presupuesto tras evaluar, nunca como cero.

Se agregan enlaces a las rutas existentes de cobertura, Radar y propuestas; no se incrustan esos módulos en el listado. ServiceCard incorpora la clase de miniatura únicamente cuando owned=true; su variante pública no recibe ese estilo.

WITHDRAWN sigue terminal y sólo lectura. Bloqueos, suspensión, providerPublishProblem y condiciones de acciones siguen intactos. No se afirma que aceptar consultas por sí solo garantice elegibilidad: también intervienen perfil, contacto, cobertura y bloqueos reales.

## Guardados, errores y confirmaciones

Se reutiliza LoadingState para productos, artículos, servicios y perfil. No se simulan registros o contadores durante carga. Se mantienen FormError, reintentos, notices y vacíos condicionados por respuestas reales.

No se modifican UUID, revisiones, locks, recuperación, relecturas ni estados congelados. El perfil conserva Cambios sin guardar/Guardando/Resultado pendiente de revisión y el requerimiento de recargar antes de reintentar. Servicios conserva confirmación remota del estado/revisión y lectura pública al publicar. Artículos conserva su reconsulta propia y contratos existentes, sin declararlos equivalentes a los de servicios.

No se muestran éxitos nuevos ni se introducen escrituras optimistas. Los diálogos existentes mantienen sus handlers, revisiones y protección busy. No se reinterpretan respuestas inciertas como éxito.

## Responsive, accesibilidad y navegación

- Se reutilizan tokens de color, escala de 8/12/16/24/32 px y radios de CercaYa. No fue necesario cambiar UX_UI_GUIDELINES.
- Listados propios de artículos/servicios: dos columnas; una hasta 760 px. Productos: dos desde 760 px, una por debajo. Pedidos: una hasta 760 px.
- Botones de acciones particulares/profesionales se apilan a ancho completo hasta 600 px; productos separa Editar de Confirmar en ese ancho.
- Foco de 3 px y etiquetas textuales de estado, no sólo color; controles con semántica de enlace/botón conservada. Se conserva movimiento reducido global.
- No se introduce otra barra fija ni footer sticky; sigue el espacio global reservado para MobileNav.
- BackLink, enlaces seguros y parámetros de los editores se conservan. Actividad sigue accesible en Header/MobileNav, sin depender de history.back().
- Deben comprobarse manualmente 320, 375, 390, 430 px, zoom, textos largos y foco: no se afirma que estén probados.

## Seguridad y rendimiento

No se modifican consultas, RPC, SQL, RLS, Auth, permisos, Storage, firmas o URLs. No hay lecturas por tarjeta nuevas, polling, Realtime adicional ni nuevas dependencias. Cobertura, condición y precio usan DTO propios ya cargados. Se conservan guardas y autorización server-side existentes.

Home, búsqueda, ProductCard público comercial, galerías de detalle y proporciones de imágenes públicas no se modifican. La clase thumbnail de ServiceCard se aplica sólo al modo propio y su regla requiere el contenedor administrativo records.

## Componentes y archivos de esta etapa

Reutilizados: LoadingState, FormError, BackLink, Dialog, ProductImage, StockConfirmation, ListingActions/Status/Confirmation, ServiceCard owned, ServicePresentation, ServiceAreasEditor, ServicePhotos, onboarding y MerchantStoreCard. Se crea sólo un CSS Module de presentación acotada; no se crea una abstracción funcional común a los tres dominios.

Modificados:
- src/components/radar/merchant-workspace.tsx
- src/components/merchant-products/product-list.tsx
- src/components/merchant-products/product-list.module.css
- src/components/merchant-products/product-form.tsx
- src/components/reservations/reservation-list.tsx
- src/components/reservations/reservation-detail.tsx
- src/components/personal-listings/my-listings.tsx
- src/components/services/my-services.tsx
- src/components/services/professional-profile.tsx
- src/components/services/service-areas-editor.tsx
- src/components/services/service-card.tsx (clase condicional owned)

Creados:
- src/components/management/management.module.css
- UX_UI_MANAGEMENT.md

Los demás archivos ya modificados del working tree pertenecen a etapas anteriores y no se atribuyen a UX/UI 8.

## Limitaciones y hallazgos para otra etapa

- Sin validación de compilación o ejecución, por restricción explícita.
- Se preserva la carga comercial de reservas existente; no se introduce paginación de backend ni se afirma haber resuelto su volumen histórico.
- MerchantWorkspace conserva el ramal legacy catalog=true y sus datos demo; el panel real no lo usa para renderizar productos. Su limpieza funcional queda fuera de alcance.
- La navegación comercial aún contiene una etiqueta Estadísticas próximamente; no se cambia RequestShell porque también sirve a Radar y recorridos fuera de gestión.
- Errores/éxitos y recuperación comerciales conservan los contratos previos; no se agrega un sistema nuevo de revisión o conciliación.
- Los motivos administrativos ya autorizados al dueño continúan en las pantallas propias; no se añaden datos de moderación ni se llevan a páginas públicas.
- No se crean filtros, operaciones de edición rápida, métricas o confirmaciones de servidor que no existían.

## Pruebas manuales pendientes

1. Abrir /comercio con/sin comercio y error de red: verificar nombre/localidad reales, accesos, onboarding, tienda, contador y mensajes de carga.
2. Recorrer Productos, Agregar, Reservas, Configurar y Radar; comprobar regreso y la navegación global de Actividad.
3. Productos STOCKED con 0, 1 y varias unidades; confirmar sin cambiar cantidad; editar precio/stock y comprobar fecha real.
4. ON_DEMAND con preparación sí/no para hoy: no mostrar unidades; confirmar disponibilidad y comprobar fecha sin cambiar reglas públicas.
5. Activar/desactivar y bloqueo administrativo: mismas acciones y permisos existentes, error visible sin éxito prematuro.
6. Formulario: obligatorios, opcionales, campos largos y error de validación; conservar valores. Subir/reemplazar/quitar/deshacer foto; esperar procesamiento y guardado.
7. Productos sin foto, vertical/horizontal/cuadrada en administración; confirmar que catálogo público e imágenes permanecen intactos.
8. Pedidos multiproducto: cantidades, total, retiro/envío, snapshots, estados y fecha; abrir detalle, confirmar, preparar, entregar o cancelar según contrato, usando datos QA.
9. Verificar que COMPLETED no se interprete como pago online y que no aparezcan acciones incompatibles con estados terminales.
10. Artículos: filtros, siguiente/anterior, condición, fotos firmadas, borrador/publicado/pausado/vendido/retirado; editar en cuatro pasos y usar confirmaciones existentes.
11. Perfil: guardar presentación, contacto autorizado, cobertura y foto por separado; cambios sin guardar, errores de red y recargar versión remota.
12. Cobertura: duplicados, límite 30 y quitar/agregar; comprobar que afecta todos los servicios sin confundir referencia con residencia/GPS.
13. Servicios: con/sin foto, FIXED/FROM/QUOTE con NULL, filtros/páginas y acciones. WITHDRAWN no ofrece edición/reactivación.
14. Dos pestañas y respuesta incierta: no mostrar éxito prematuro ni repetir automáticamente operaciones; mantener UUID, revisión y recuperación.
15. Cuenta suspendida, recurso bloqueado y cuenta ajena: conservar guardas de lectura/escritura sin exponer nuevos datos.
16. 320/375/390/430 px y desktop: sin scroll horizontal, controles legibles, precios largos, foco visible, teclado, diálogos/Escape, zoom 200 %, MobileNav sin tapar acciones.

No se iniciaron pruebas integrales ni otra etapa UX/UI.

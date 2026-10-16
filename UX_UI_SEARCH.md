# CercaYa — UX/UI 3: buscador, filtros y resultados

## Alcance y método

Trabajo sobre el explorador real de `Marketplace`, conservando el sistema visual de `UX_UI_GUIDELINES.md` y la Home documentada en `UX_UI_HOME.md`.

Revisión por lectura de componentes, consultas, navegación y cambios existentes. No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni despliegues. No se instalaron dependencias. La revisión en ejecución queda pendiente.

## Auditoría inicial

- Las cuatro opciones de dominio eran chips sin una jerarquía propia de navegación de resultados.
- El hero completo y los accesos de descubrimiento consumían espacio incluso después de empezar a buscar.
- Los filtros se presentaban con estilos y paginaciones distintos; no existía una representación consistente de filtros activos removibles.
- El reset comercial borraba texto, categoría y otros criterios de navegación. Una limpieza de filtros no debe borrar la búsqueda ni la ubicación.
- La categoría comercial y particular compartía `category`, impidiendo modificar o limpiar una sin afectar la otra.
- Los errores de categorías podían dejar controles deshabilitados sin reintento visible en la vista de búsqueda.
- Particulares y servicios sólo ofrecían un enlace para abrir el selector cuando faltaba localidad; ahora el formulario está visible directamente si falta un contexto válido.
- Los productos comerciales volvían a `/`, perdiendo los criterios en el enlace de retorno. Artículos y servicios ya contaban con retorno validado.
- Los indicadores de carga de particulares y servicios tenían menos presencia que los skeletons comerciales.
- Las tarjetas de servicios usaban h2 dentro de secciones h2; la búsqueda ahora puede usar h3 sin cambiar la jerarquía de otras pantallas.

## Arquitectura visual

La misma página y el mismo `query` siguen controlando todos los resultados. En búsqueda/guardados, Hero usa una variante compacta: título, explicación breve y el mismo formulario de búsqueda. La Home mantiene su presentación amplia y sus accesos de descubrimiento.

El explorador incluye:

1. Encabezado breve de orientación.
2. Todo / Comercios / Particulares / Servicios.
3. Secciones independientes con encabezado, filtros propios, alcance geográfico, chips, feedback, tarjetas y paginación.
4. Acciones existentes para publicar necesidades, sin crear flujos nuevos.

Todo no mezcla los registros ni calcula un total global. Comercios mantiene además sus grupos independientes de distancia y localidad, y resultados de tiendas cuando corresponde. No se descargan todos los registros ni se filtran tarjetas después de paginar.

## Componentes compartidos nuevos

`src/components/search/search-controls.tsx`:

- `SearchDomains`: grupo de cuatro botones con aria-pressed, marca de selección visible y desplazamiento horizontal si hace falta. No usa role=tab sin implementar el patrón de teclado de pestañas; los botones nativos funcionan con Tab/Enter/Espacio.
- `FilterPanel`: fieldset con legend e indicación de aplicación inmediata. Los controles permanecen visibles; no hay modal ni un segundo estado de filtros pendientes.
- `ActiveFilters`: chips removibles con nombres accesibles y limpieza del dominio.
- `SearchPagination`: Anterior/Siguiente, página actual, cantidad de páginas y total real recibido. No consulta datos.

`search-experience.module.css` contiene la composición del explorador. Se reutilizan LoadingState, los botones, campos, tokens, ProductSkeletonGrid, imágenes y componentes de tarjetas existentes.

## Filtros por dominio y limpieza

| Dominio | Controles | Limpiar filtros conserva |
| --- | --- | --- |
| Comercios | Categoría comercial, radio cuando hay coordenadas, Hoy, envío, retiro, disponibilidad confirmada y orden existentes | Texto, ubicación, radio aplicado como alcance, dominio y filtros particulares/servicios |
| Particulares | Categoría propia, nuevo/usado, orden por fecha/precio, localidad/provincia | Texto, localidad/provincia, dominio y filtros comerciales/servicios |
| Servicios | Grupo/especialidad real y localidad/provincia | Texto, cobertura consultada, dominio y filtros de los otros dominios |

Quitar una categoría no borra la localidad. Quitar el chip de orden restaura el orden predeterminado del dominio. La ubicación se trata como contexto, no como un chip que desaparece al limpiar filtros. El radio conserva sus opciones existentes y se modifica expresamente en su control.

Los selectores siguen aplicando cambios al elegirlos. El formulario manual de localidad usa su borrador de campos existente: Buscar en esta localidad aplica; Cancelar descarta la edición visible cuando ya hay una localidad válida. No se crea un panel modal de filtros.

### Compatibilidad de categoría particular

Se agregó únicamente un parámetro frontend: `personal_category`.

- Ausente: `personalCategory = null`; conserva el significado histórico de `category` como categoría inicial de ambos dominios de productos.
- Presente: categoría específica de particulares; `personal_category=` significa explícitamente Todas las categorías, aunque comercios tenga una categoría seleccionada.
- Al editar categoría comercial, se conserva la categoría efectiva de particulares antes del cambio.
- Al editar/limpiar particulares sólo cambia su categoría propia, condición/orden y página.
- Las categorías visuales de Home conservan su elección compartida deliberada para productos/artículos; no usan categorías de servicios.
- No cambian IDs, tablas, firmas RPC ni los filtros soportados por el backend.
- La serialización y la validación de retornos conservan el nuevo parámetro. No se admiten destinos externos.

Se revisaron por lectura los consumidores de `SearchNavigation`; los estados se construyen con `readSearchNavigation` o mediante spread del estado existente. No se ejecutó el chequeo de TypeScript por restricción del pedido.

## Ubicación: tres semánticas conservadas

- Comercios: coordenadas reales del comprador, radio existente y fallback comercial por localidad canónica. Se muestra si la ubicación está activa y se ofrece Revisar ubicación. Elegir localidad manual no mueve coordenadas comerciales.
- Particulares: localidad/provincia efectivas; no se muestran kilómetros.
- Servicios: localidad/provincia consultadas y cobertura declarada del profesional; no se presenta como distancia ni disponibilidad inmediata.

La arquitectura existente sincroniza la elección manual entre artículos y servicios. Se conserva esa sincronización y se explica en los formularios. No se afirma que sus selectores controlen comercios. Si un enlace contiene alcances distintos, cada sección muestra el que realmente utiliza.

Sin localidad válida, particulares y servicios muestran directamente los campos de provincia/localidad usando ArticleLocality. No exigen GPS. Las sugerencias opcionales conservan su mecanismo existente y sólo se solicitan al pulsar su botón.

## Tarjetas

Se mantienen componentes separados:

- Comerciales: ProductCard, fotografía, nombre, precio, comercio, stock/ON_DEMAND, confirmación, distancia o localidad, retiro/envío y guardados. La acción Ver producto conserva el retorno del explorador.
- Particulares: PublicListingCard, precio, condición, localidad/provincia, etiqueta Particular y acceso completo a Ver artículo. No incluye stock, carrito o reservas.
- Servicios: ServiceCard, especialidad, título, profesional, localidades declaradas, consultas y precio real. Se conserva servicePriceLabel: QUOTE/importe nulo = A presupuestar; FROM = Desde; FIXED = importe. No se agregan reseñas ni disponibilidad inmediata.

Los estilos del explorador armonizan bordes, radios, espaciados, imágenes contenidas y precios. La variante h3 se usa en servicios dentro de resultados; otros consumidores pueden conservar su encabezado anterior. No se crea una tarjeta universal ni se rediseñan detalles.

## Carga, errores y vacíos

- Carga comercial: skeletons existentes por grupo; particulares y servicios: LoadingState compartido.
- Se conservan las claves de respuesta, enabled, abortos y protección contra resultados obsoletos de cada hook/componente.
- Los totales no se presentan como confirmados mientras el grupo correspondiente carga o falla.
- Los errores de categorías comerciales/particulares tienen reintento conectado a la carga existente compartida.
- Cada dominio conserva errores/reintentos de resultados y de fotos firmadas. Un fallo no bloquea el resto.
- Particulares sin resultados: explicación y Cambiar localidad; los chips permiten quitar criterios sin borrar texto.
- Servicios sin resultados: explicación según cobertura y acceso a la solicitud existente de servicios.
- Comercios: se conservan ampliar radio, Pedido Abierto comercial, falta de ubicación y resultados por localidad. Limpiar filtros ya no borra el texto.
- No se promete avisar automáticamente ni se inventan resultados durante cargas o errores.

## Paginación y retorno

- Se conserva la paginación backend y los tamaños existentes: no hay paginación global ni filtrado posterior de registros.
- Cada grupo tiene controles propios y total real.
- Cambiar página desplaza al inicio de su sección/grupo; no lleva al inicio de otro dominio.
- Los enlaces de artículos y servicios conservan sus helpers de contexto y returnTo seguro.
- ProductCard admite returnTo opcional. Los productos del explorador lo envían a la ruta existente `/producto/[id]`.
- La página de producto valida ese valor con el helper existente que sólo admite el explorador local y parámetros conocidos, y lo utiliza en Volver a explorar, en el estado no disponible y al reintentar. Enlaces sin contexto siguen volviendo a `/`.
- No se crea otra ruta de detalle ni una redirección externa. La modificación del detalle es exclusivamente el destino del retorno.
- Se conserva el mecanismo existente de historial/URL de Marketplace; no se introduce una segunda fuente de búsqueda.

## Responsive y accesibilidad

- Mobile-first: barra legible, input existente de 16 px, botones táctiles y controles de filtros visibles sin overlays.
- Las cuatro opciones pueden desplazarse horizontalmente sin comprimir sus textos; selección mediante marca, peso y color.
- Filtros en columnas sólo cuando hay espacio; selects y acciones se apilan en móvil.
- Tarjetas completas en una columna hasta 600 px para no sacrificar información.
- Paginación móvil coloca el indicador sobre Anterior/Siguiente; ambas acciones conservan 44/48 px y estados disabled.
- Desktop mantiene `.shell`, grillas adaptables y paneles por dominio, sin sidebar vacío ni ancho ilimitado.
- Landmarks, labels, fieldset/legend, botones nativos, enlaces reales, aria-pressed y foco global existente.
- No se agrega animación; se conservan las preferencias de movimiento reducido y la única barra inferior global con safe-area.
- Los chips anuncian qué filtro quitan. Los resultados mantienen encabezados y estados accesibles propios.

## Archivos de esta etapa

Creados:

- `src/components/search/search-controls.tsx`
- `src/components/search/search-experience.module.css`
- `UX_UI_SEARCH.md`

Modificados:

- `src/components/marketplace.tsx`
- `src/components/home/hero.tsx`
- `src/components/home/home-discovery.module.css`
- `src/components/home/catalog.tsx`
- `src/components/home/product-card.tsx`
- `src/components/personal-listings/personal-search.tsx`
- `src/components/personal-listings/public-listing-card.tsx`
- `src/components/services/service-search.tsx`
- `src/components/services/service-card.tsx`
- `src/lib/search-navigation.ts`
- `src/app/producto/[id]/page.tsx`
- `src/components/details/public-product-detail.tsx`
- `UX_UI_GUIDELINES.md` (reglas compartidas de filtros/paginación)

Los cambios previos no relacionados del working tree se conservan. No se modifican SQL, clientes Supabase, RPC, políticas, Auth, reglas de precio, stock o geolocalización.

## Limitaciones y revisión manual pendiente

Todo conserva páginas finitas por dominio, pero una página con muchos resultados puede requerir desplazamiento. No se ocultan registros después de paginar para acortar artificialmente la vista. No se introdujo una nueva estrategia de fetching.

No se verificó en ejecución el layout, la compilación o el retorno. Antes de dar la etapa por validada:

1. Revisar 320/375/390/430 px, tablet y desktop; zoom 200 %, nombres largos, precios largos y ausencia de overflow accidental.
2. Buscar, borrar y enviar desde el mismo campo; comprobar parámetros y pestaña en refresh.
3. Recorrer Todo/Comercios/Particulares/Servicios con teclado; revisar selección y scroll horizontal limitado a su grupo.
4. Aplicar categorías distintas en comercio y particular, quitar chips y limpiar cada dominio. Confirmar que texto, localidad y filtros ajenos se conservan.
5. Abrir un enlace antiguo con category sin personal_category, luego modificar cada dominio. Probar también personal_category vacío y categoría no disponible.
6. Sin GPS, elegir localidad manual para artículos/servicios; confirmar que no cambia el alcance comercial. Con GPS, probar radio/fallback/entrega y Revisar ubicación.
7. Probar condition NEW/USED, ordenamientos, especialidades y modalidad QUOTE/FROM/FIXED sin añadir filtros no soportados.
8. Abrir y volver desde producto, artículo, servicio y perfil; comprobar dominio, texto, localidades, filtros y páginas. Probar también el botón Atrás del navegador.
9. Probar returnTo externo, protocol-relative, con barra invertida o ruta ajena: el retorno comercial debe caer en `/`.
10. Probar páginas independientes por grupo y saltos al encabezado correcto, sin reconsultas ajenas innecesarias.
11. Simular red lenta/error/categorías fallidas/fotos vencidas; probar sus reintentos. No deben verse resultados anteriores como si fueran los actuales.
12. Probar estados vacíos y acciones: localidad, ampliar radio, solicitud de producto y solicitud de servicio.
13. Revisar foco, lectura de chips, formularios de localidad, Cancelar, textos con zoom y navegación inferior sin tapar acciones.
14. Confirmar que Home inicial, Header, Actividad, cuenta, carrito, reservas, guardados, Radars, WhatsApp y publicación conservan sus accesos existentes.

El siguiente prompt corresponde al rediseño de detalles; aquí sólo se ajusta el retorno comercial necesario para conservar la búsqueda.

## Refinamiento UX/UI 3.1

### Presentación, sin cambios funcionales

- Tipografía normal y metadata de Home, filtros y tarjetas ajustadas hacia 14–16 px. Etiquetas auxiliares de navegación conservan 13 px cuando el ancho móvil lo requiere; barra inferior de cinco accesos en 13 px, sin reducir sus áreas táctiles.
- Filtros comerciales: categoría y disponibilidad siguen visibles, junto al resumen del radio/localidad. Distancia detallada, envío, retiro y orden pasan a un disclosure nativo “Más filtros”. Los chips activos permanecen fuera y visibles aunque el disclosure esté cerrado. Se mantienen valores, opciones, defaults, onToggle/onSort/onRadius y consultas.
- El fieldset comercial comparte categoría y disponibilidad en una fila cuando hay ancho; se apila en pantallas estrechas. La explicación de aplicación inmediata sigue accesible, sin repetir una línea visible en todos los grupos.
- En Todo, los controles de artículos y servicios se agrupan en disclosures compactos que indican localidad y filtros. Sus pestañas individuales mantienen el formulario completo visible. Se aplica la misma presentación compacta también cuando hay resultados, para evitar saltos de estructura al resolver una consulta. Los estados vacíos tienen menos padding y titulares más pequeños; conservan acciones reales. Cambiar localidad desde el vacío de particulares abre el disclosure que contiene el editor.
- Las secciones y tarjetas siguen montadas según la arquitectura existente. Plegar filtros no deshabilita fetching, altera resultados, elimina parámetros ni introduce estados pendientes de aplicar.
- Los disclosures usan details/summary, Tab/Enter/Espacio y foco existente. No son modales ni overlays; para cerrar se vuelve a activar su summary. No requieren focus trap y no tapan MobileNav.

### Tarjetas y disponibilidad

ProductCard conserva todos sus datos y handlers, pero ordena fotografía, nombre/precio, comercio/localidad, estado y confirmación, retiro/envío y detalle. La categoría permanece como metadata. El estado sale de la fotografía y pasa al cuerpo, evitando superposiciones; el cuadro de confirmación deja de ser otro bloque con borde y fondo fuerte. Los nombres de comercios pueden envolver líneas.

Se revisó `isProductAvailable`: STOCKED usa stock > 0; ON_DEMAND usa available_today. Se conserva exactamente esa evaluación. ON_DEMAND mantiene “Se prepara a pedido”; Disponible hoy/No disponible hoy se muestra una vez en su etiqueta de estado. Debajo se aclara “Informado por el comercio”. STOCKED mantiene En stock/Sin stock y la última confirmación separada.

Stock informado y fecha de confirmación son datos diferentes: una cantidad positiva no demuestra confirmación reciente ni garantiza disponibilidad al llegar. Se conserva la fecha real, incluso si es antigua; no se modifica caducidad, stock, backend ni promesa de retiro/envío. La UI mantiene los textos de cobertura actuales y el aviso de consultar al comercio.

### Distancias

`getPublicCatalog` construye las distancias de las cards mediante `businessDistance`, con coordenadas reales recibidas; `distanceKm` utiliza Haversine. El formateador existente redondea metros y puede mostrar 0 m cuando las coordenadas coinciden o la distancia es menor al redondeo. La precisión/origen fino de las coordenadas no viaja como un dato de precisión a ProductCard.

Sólo cambia la representación en ProductCard real:

- Distancia calculada menor a 0,1 km: “Muy cerca · distancia aprox.”, sin afirmar metros exactos.
- Resto: distancia formateada existente más “aprox.”.
- Sin distancia: localidad o acceso a ubicación, como antes.

No se cambia Haversine, formatter global, coordenadas, orden ni radio. No se inventa un valor nuevo. Otros componentes que usan formatDistance conservan su presentación y quedan fuera de este refinamiento.

### Home y categorías

El panel derecho ya no vuelve a enumerar los tres dominios. Explica beneficios complementarios: elegir zona, revisar información publicada y pedir algo que no está. Los tres accesos reales de descubrimiento se conservan intactos.

Por lectura del repositorio, Electricidad aparece en `supabase/seed.sql` dentro de `public.categories`, como subcategoría de Ferretería (ID 10000000-...-0002). También aparece en `supabase/services.sql` como categoría propia de servicios (ID 51000000-...-0102). Son tablas/IDs distintos. El seed histórico documenta la taxonomía, no confirma qué filas existen actualmente en producción; no se consultó Supabase.

Categories recibe sólo las filas de `getPublicCategories`, que consulta `categories`; su descripción aclara productos y artículos. Servicios conserva readServiceCategories, sus IDs y su selector. No se cambian destinos, selección, categorías ni contratos. El nombre coincidente no significa que ambas categorías deban fusionarse.

### Archivos del refinamiento

- `src/components/home/hero.tsx`
- `src/components/home/home-discovery.module.css`
- `src/components/home/home-upper.module.css`
- `src/components/home/catalog.tsx`
- `src/components/home/quick-filters.tsx`
- `src/components/home/product-card.tsx`
- `src/components/home/product-card.module.css` (nuevo, estilos de la card compartida)
- `src/components/search/search-controls.tsx`
- `src/components/search/search-experience.module.css`
- `src/components/navigation/global-navigation.module.css`
- `src/components/personal-listings/personal-search.tsx`
- `src/components/services/service-search.tsx`
- `UX_UI_SEARCH.md`
- `UX_UI_HOME.md`
- `UX_UI_GUIDELINES.md`

### Pendientes y revisión manual de 3.1

No se detectó por lectura una necesidad de cambiar el cálculo o backend. No se puede confirmar precisión GPS, vigencia real del stock o categorías instaladas sólo desde el frontend. Ninguna de esas propiedades se presenta como garantizada.

1. Revisar 320/375/390/430 px, tablet y desktop; textos largos, zoom 200 %, precios y nombres completos, sin overflow ni controles tapados por la barra inferior.
2. Comparar filtro cerrado/abierto: categoría, Hoy/confirmación, radio y chips visibles; abrir Más filtros con teclado y modificar envío, retiro, distancia y orden. Cerrar y comprobar que los chips/valores se conservan.
3. En Todo, abrir los filtros de artículos y servicios; probar vacío, carga, error y resultados. Ir a las pestañas individuales y comprobar acceso completo. Cambiar localidad desde el vacío de particulares debe mostrar el formulario.
4. Revisar cards STOCKED con/sin stock y con confirmación antigua/nula; ON_DEMAND disponible/no disponible. Comprobar que no se duplican los estados de hoy y que retiro/envío permanecen.
5. Probar un comercio con distancia 0 o muy pequeña, otra distancia normal y uno sin coordenadas. No debe mostrarse A 0 m de vos en ProductCard real ni agregarse un valor de distancia inventado.
6. Probar Electricidad desde categorías de productos y desde servicios; verificar IDs y resultados del dominio correcto, sin interpretar el nombre como una taxonomía única.
7. Confirmar que búsqueda, filtros, URL, paginación, guardados, detalle/retorno, carrito y reservas siguen usando sus flujos actuales.

No se ejecutó ninguna validación automática ni se abrió navegador. UX/UI 4 no se inició.

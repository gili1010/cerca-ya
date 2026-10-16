# CercaYa — Home UX/UI 2

## Alcance y revisión previa

Se rediseñó la Home existente en `Marketplace`, sin crear otra página ni reemplazar la arquitectura de búsqueda. Se revisaron por lectura Hero, Header, MobileNav, Categories, Catalog, ProductCard, PersonalSearch, ServiceSearch, NavigationItem, los hooks de catálogo y tiendas, el estado URL, los controles de ubicación y `UX_UI_GUIDELINES.md`.

No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni despliegues. Esta entrega requiere revisión manual; no afirma validación visual o funcional en ejecución.

### Problemas encontrados

- El hero comunicaba sólo productos comerciales, aunque la plataforma ya busca artículos particulares y servicios.
- Buscar, buscar con foto, publicar una necesidad y la acción urgente competían al inicio. La búsqueda con foto todavía no está disponible.
- La ilustración ocupaba espacio sin representar resultados reales. Se reemplazó por una explicación discreta de los tres dominios en desktop; no es un catálogo ni muestra comercios ficticios.
- El contexto local dependía del Header. Su diálogo actual ofrece GPS, no un selector manual común.
- Las categorías no estaban limitadas, omitían una categoría por slug y la acción Ver todo limpiaba la selección en vez de mostrar más categorías.
- La invitación a pedir un producto aparecía temprano; no había un bloque equivalente claro que distinguiera solicitud comercial de solicitud de servicio al final del descubrimiento.
- El título del catálogo podía ocultar la semántica Disponible hoy cuando había varios dominios visibles.

## Jerarquía y estructura

1. Header global del Prompt 1, sin cambios.
2. Hero: “Lo que necesitás, más cerca.”, descripción concreta y un único buscador.
3. Contexto local y selección manual para particulares/servicios; acceso independiente a ubicación comercial.
4. Acceso secundario Disponible hoy, conectado al handler existente de productos comerciales con filtros today y confirmed.
5. “¿Qué necesitás encontrar?”: tres accesos completos a Comercios, Particulares y Servicios.
6. Pestañas existentes Todo/Comercios/Particulares/Servicios, conservadas.
7. Categorías reales compartidas por productos y artículos, cuando el dominio corresponde.
8. Resultados comerciales reales, incluidos grupos geográficos/localidad, tiendas en búsquedas, estados, filtros, paginación y guardados.
9. Artículos de vecinos reales, con búsqueda y paginación existentes.
10. Profesionales y oficios reales, con categorías propias y cobertura declarada.
11. “¿No encontraste lo que buscabas?”: dos flujos separados para pedir un producto o un servicio.
12. Invitación discreta a vender un artículo, ofrecer un servicio o crear una tienda.
13. Footer y navegación móvil global existentes.

Las secciones de resultados se muestran según el dominio y la vista actuales. No se agregan carruseles de resultados duplicados ni una segunda consulta de destacados.

## Buscador y navegación

- Se mantiene `query` del estado URL como única fuente de texto.
- El input conserva `inputRef`, `onQuery`, envío mediante `onSearch` y botón accesible Borrar búsqueda.
- Buscar mantiene los resets, analytics, reintento de servicios y desplazamiento existentes.
- Los accesos por tipo usan `updateNavigation` con el dominio correspondiente y `view: search`, sin limpiar el texto ni inventar filtros. Se desplazan al explorador actual.
- Las pestañas existentes mantienen sus handlers.
- Pedido de producto usa `/pedido/nuevo?q=...`, conservando el texto prellenado.
- Pedido de servicio usa `/necesito-un-servicio`.
- Publicar utiliza `/publicar/articulo`, `/publicar/servicio` y `/comercio/crear`. Las guardas actuales siguen decidiendo cuándo se necesita sesión.
- No se crean rutas ni callbacks de autenticación.

## Categorías

- Se reutiliza la consulta actual `getPublicCategories`; no se agregan consultas.
- Inicialmente se muestran hasta ocho categorías y se conserva visible cualquier categoría seleccionada fuera de ese grupo.
- Ver todas/Ver menos amplía o reduce la lista ya cargada. Es estado de presentación local, no otro filtro ni una ruta nueva.
- Se elimina la exclusión visual fija de pintura: todas las categorías retornadas quedan disponibles al ampliar.
- La selección sigue llamando al mismo `onChange`, con los mismos resets de query/filtros/página.
- Se muestra explícitamente que estas categorías corresponden a productos y artículos. Los IDs de servicios no se mezclan con ellas.
- Las categorías y grupos reales de servicios permanecen en su selector existente. No se hace otra llamada para dibujarlos de nuevo en el hero.

## Ubicación y privacidad

`HomeLocality` reutiliza `ArticleLocality` y la normalización/validación existente de provincias. La selección manual escribe los parámetros de localidad de particulares mediante `updateNavigation`, que ya sincroniza la cobertura manual de servicios. No altera la ubicación canónica del comprador ni guarda coordenadas nuevas.

- El texto principal aclara “Artículos y servicios en…” y muestra localidad/provincia sólo cuando corresponden a una provincia reconocida.
- Cambiar/Elegir localidad abre el formulario manual: no solicita GPS ni domicilio.
- El formulario explica expresamente que no cambia el alcance comercial.
- El enlace independiente de ubicación comercial abre el diálogo actual. GPS, distancias, Haversine y fallback por localidad comercial siguen funcionando igual.
- Cada sección conserva y muestra su alcance real y sus controles manuales existentes.
- No se aplican coordenadas comerciales a artículos ni se convierte cobertura profesional en radio GPS.
- Sin localidad se invita a elegirla, sin inventar una ciudad ni afirmar cercanía.

Limitación existente: la selección manual de artículos/servicios no crea una localidad canónica comercial. Hacer que también afectara a comercios requeriría otra decisión funcional y no se implementó en este prompt.

## Resultados y disponibilidad

- `Catalog`, `ProductCard`, `ProductImage`, `StockConfirmation`, `QuickFilters`, paginación y resultados de tiendas se conservan.
- Se refina su composición sólo dentro del contenedor Home: precio más visible, espaciado, separación del comercio y área táctil de guardados.
- No se cambia ProductCard ni se crea una tarjeta universal. Productos, artículos y servicios conservan su información y acciones propias.
- El título Disponible hoy se muestra cuando el filtro real today está activo y no hay una búsqueda textual prioritaria. El filtro sigue visible en la barra existente.
- No se afirma que todos los productos tengan stock recién confirmado ni envío hoy; se indica disponibilidad informada por cada comercio.
- El acceso Disponible hoy mantiene exactamente la combinación comercial today + confirmed existente. No filtra particulares ni servicios como stock.
- “Artículos de vecinos” conserva fotos firmadas, precio, condición, localidad, enlaces y paginación.
- “Profesionales y oficios” conserva categorías, localidad consultada, cobertura, precios/modalidades y contactos autorizados existentes.

## Responsive y accesibilidad

### Mobile-first

- Hero compacto, sin ilustración lateral hasta 800 px.
- Input de 16 px y botón Buscar de 48 px, con nombre accesible también cuando se oculta su texto visual en móvil.
- Accesos por dominio apilados como filas compactas, con icono, título, descripción y superficie completa clickeable.
- Categorías en scroll horizontal existente, accesibles mediante Tab; bordes, foco y texto acompañan al color.
- Productos en dos columnas cuando hay espacio; una columna hasta 360 px para preservar lectura e información.
- Necesidades con botones apilados; invitación a ofrecer en enlaces cómodos, sin CTA flotante.
- Se conserva una sola barra inferior y el padding/safe-area ya implementados.
- El selector manual se abre sólo a pedido; sus campos reutilizan la adaptación móvil existente.

### Desktop

- Ancho máximo `.shell` existente (1280 px).
- Hero en dos columnas: búsqueda dominante y explicación de los dominios en un panel sobrio.
- Tres accesos de descubrimiento en columnas; categorías acotadas y grilla comercial existente de hasta cuatro columnas.
- Solicitudes y publicación tienen menor peso visual y aparecen después de resultados.

### Accesibilidad

- Un h1 y secciones con encabezados identificables.
- Buscador con landmark search, input etiquetado, botón de limpiar y submit con nombres claros.
- Iconos decorativos ocultos a lectores de pantalla.
- Botones nativos, enlaces reales, controles expandibles con aria-expanded/aria-controls, foco global visible.
- Etiquetas visibles de campos y mensajes de carga/error existentes conservados.
- No se agregan animaciones. Se mantienen las preferencias de movimiento reducido del sistema.
- La compatibilidad con zoom, 320 px y safe-area requiere la revisión manual indicada abajo.

## Estados y rendimiento

- Categorías: skeleton anunciado de forma discreta, error con reintento real y mensaje de lista vacía.
- Catálogo: skeletons existentes, errores independientes para distancia/localidad, estados vacíos y expansión de radio existentes.
- Particulares/servicios: indicadores, errores, reintentos, falta de localidad, ausencia de resultados y páginas obsoletas conservados.
- Sin sesión: exploración pública existente; login sólo mediante guardas vigentes.
- No hay estadísticas, reseñas, descuentos, prestadores, notificaciones ni productos simulados nuevos.
- No hay nuevas consultas Supabase. Se mantienen tamaños de página, enabled por dominio, debounce, abortos, renovación de URLs firmadas y reconsultas existentes.
- El formulario manual conserva la búsqueda opcional de sugerencias de `ArticleLocality`, sólo al pedirla; no ejecuta geocoding al renderizar.
- No se modifican mecanismos de carga/optimización de imágenes. No hay nuevas fotografías ni imágenes decorativas remotas.

## Componentes y archivos

Nuevos:

- `src/components/home/home-discovery.tsx`: DiscoveryEntrances y HomeParticipation.
- `src/components/home/home-locality.tsx`: presentación y edición manual usando el componente y parámetros existentes.
- `src/components/home/home-discovery.module.css`: estilos acotados a Home, responsive y composición de tarjetas existentes.
- `UX_UI_HOME.md`: este documento.

Modificados en esta etapa:

- `src/components/marketplace.tsx`: composición e integración de los accesos; no se reescriben consultas ni handlers existentes.
- `src/components/home/hero.tsx`: nuevo hero y buscador conectado al mismo estado.
- `src/components/home/categories.tsx`: jerarquía, skeleton, selección breve y expansión de la lista cargada.
- `src/components/home/catalog.tsx`: título y descripción, sin cambios de filtrado ni consultas.
- `src/components/personal-listings/personal-search.tsx`: sólo título visible “Artículos de vecinos”.
- `src/components/services/service-search.tsx`: sólo título visible “Profesionales y oficios”.

Se reutilizan los tokens y SectionHeader del Prompt 1. `UX_UI_GUIDELINES.md` no cambia: no se introducen reglas globales nuevas. Los archivos previos no relacionados en el working tree se conservan.

## Revisión manual pendiente

1. Abrir Home en 320/375/390/430 px y desktop 1024/1440 px; comprobar buscador, tarjetas, títulos largos y ausencia de scroll horizontal accidental.
2. Sin GPS y sin localidad: elegir provincia/localidad en el hero. Verificar artículos y servicios sin exigir GPS; comercios debe conservar su estado real.
3. Con GPS: comprobar texto local, radio comercial, fallback y distancias. Elegir otra localidad manual y confirmar que no mueve coordenadas comerciales.
4. Escribir, borrar y enviar una búsqueda. Revisar URL, refresh y atrás/adelante sin pérdida de filtros ni eventos analytics por simple carga.
5. Probar los tres accesos, las cuatro pestañas y Guardados. Conservar texto y criterios existentes al cambiar de dominio.
6. Expandir/reducir categorías, seleccionar una posterior a las ocho iniciales y verificar que siga visible. Confirmar que servicios usa sus IDs propios.
7. Disponible hoy: comprobar dominio comercial y filtros today/confirmed; revisar que el stock/entrega mostrados coincidan con cada producto real.
8. Probar paginación de distancia y localidad, artículos y servicios, sin resultados duplicados por nuevas secciones.
9. Comprobar detalles, tienda, carrito/reservas, fotos firmadas y renovación de imágenes sin modificar datos reales innecesariamente.
10. Abrir Necesito un producto con texto escrito y comprobar prellenado; abrir Necesito un servicio y revisar que conserva su flujo separado.
11. Abrir las tres invitaciones a ofrecer con y sin sesión, comprobando las guardas actuales.
12. Probar errores de conexión, reintentos y listas vacías; no deben aparecer éxitos ni resultados falsos.
13. Tab/Shift+Tab, Enter, foco, lector de pantalla, zoom 200 %, movimiento reducido, safe-area y barra inferior sin tapar el final de formularios.

## Pendientes para otros prompts

El rediseño completo del explorador y filtros queda para la siguiente etapa. No se reestructuraron sus controles ni se ocultaron en carruseles nuevos. Detalles, formularios, cuenta, administración, paneles, Radars y propuestas siguen fuera de alcance. La presentación final no se verificó en navegador por restricción del pedido.

## Refinamiento visual 3.1

Se conserva la estructura de Home y sus tres accesos de descubrimiento. El panel derecho ahora explica elegir zona, revisar información y publicar una necesidad, evitando volver a enumerar Comercios/Particulares/Servicios. Se aumenta legibilidad de descripciones y localidad a 14 px. No cambian el buscador, los destinos ni las consultas. Los refinamientos de filtros, tarjetas y distancias se documentan en la sección 3.1 de `UX_UI_SEARCH.md`; falta revisión manual en ejecución.

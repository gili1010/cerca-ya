# CercaYa — UX/UI 4: detalles públicos

## Alcance y método

Implementación acotada a producto comercial, artículo particular, servicio y perfil público profesional. Revisión por lectura del working tree, componentes, rutas, tokens, documentación UX/UI 1–3 y guías instaladas de Next.js sobre Server/Client Components y not-found. No se ejecutaron tests, lint, TypeScript, build, navegador, servidores ni SQL. Las decisiones responsive y de interacción requieren la revisión manual indicada abajo.

No se modificaron tarjetas comerciales, ProductImage global, grillas de resultados, formularios, backend, RPC, contratos de datos, consultas, Auth, stock, permisos ni reglas geográficas. La tienda pública actual se conserva sin otro rediseño.

## Hallazgos

- El detalle comercial mostraba una sola fotografía con reglas globales cover; podía recortar flyers. La descripción y el bloque comercial aparecían antes de agregar al pedido.
- Artículos y servicios ya tenían galerías, pero sin ampliación compartida. El servicio sin fotos no reservaba el mismo marco visual.
- Las presentaciones se reutilizan en formularios y vistas privadas: cambiar sus estilos globalmente afectaría módulos fuera de alcance.
- El perfil profesional repetía su nombre en h1 y h2. Cobertura y referencia geográfica necesitaban separación visual.
- ServiceShell incorporaba accesos de gestión profesional encima del detalle público. Las rutas públicas ahora usan PersonalShell y su navegación global; la gestión conserva ServiceShell.
- Los errores de carga de servicios/prestadores reintentaban sin conservar el contexto completo. Las rutas conservan ahora el contexto saneado mediante los helpers existentes.
- Los recursos no encontrados de artículos/servicios/perfiles usaban estados locales de no disponibilidad sin retorno contextual. Se unificaron esos límites not-found, conservando notFound y sin atribuir un motivo privado.

## Estructura y componentes

`public-details.module.css` define estilos exclusivamente de detalle: dos columnas desde más de 900 px, galería a la izquierda y resumen a la derecha, superficies blancas y bordes suaves, títulos fluidos, precio destacado, metadata de 14 px, descripción de 16 px y separadores discretos. En móvil/tablet se apilan sin reordenar mediante CSS los controles del teclado.

`DetailGallery` comparte sólo presentación e interacción de fotografías. `DetailUnavailable` comparte la presentación de contenidos no públicos y el retorno seguro. Se reutilizan BackLink, Dialog, ProductImage, LoadingState, PersonalShell y las acciones de cada dominio. Las presentaciones de artículos/servicios reciben `publicDetail`, desactivado por defecto: sus galerías y composición privadas permanecen en el camino anterior. No se crea un componente funcional único para vender productos y contratar servicios.

## Detalle comercial

Tipo y categoría, nombre, precio ARS, comercio/localidad, STOCKED u ON_DEMAND, retiro/envío y acción existente Agregar al pedido. Descripción ampliada y bloque Vendido por con acceso a la tienda quedan después de la acción. Favoritos y reporte siguen disponibles como secundarios, al igual que WhatsApp.

Se conservan `isProductAvailable`, `isOnDemand`, StockTime, AddToOrder, SaveProduct, ReportButton, BusinessDistance y todos sus contratos/handlers. La fecha de confirmación STOCKED sigue separada de la cantidad. La disponibilidad se identifica como informada por el comercio, sin garantía de stock ni promesa nueva. BusinessDistance mantiene el cálculo existente y se acompaña con aclaración de distancia aproximada.

El modelo Product usado por el detalle contiene únicamente la imagen principal ya seleccionada por el adaptador. Se utiliza esa imagen; no se agregaron consultas ni se amplió el contrato para obtener otras. La galería admite varias fotos cuando el dominio ya las entrega.

## Artículo particular

Mantiene condición nuevo/usado, precio, negociabilidad, categoría, localidad y nombre público del vendedor. Consultar al vendedor precede la descripción ampliada. La fecha pública existente se conserva. No incorpora stock, carrito, reserva ni cobro. La vista pública conserva su reconsulta de disponibilidad, expiración y ocultamiento de datos/contacto cuando falla o deja de ser pública. La vista previa y la vista del propietario no activan el nuevo diseño público.

## Servicio

Mantiene `servicePriceLabel`: FIXED con etiqueta Precio fijo, FROM como Desde y QUOTE/null como A presupuestar, nunca cero inventado. Se mantienen las modalidades actuales A domicilio o lugar coordinado / En el lugar del prestador / Remoto, sin domicilio privado.

Nombre del prestador, localidad de referencia y recepción de consultas acompañan al precio. La consulta autorizada queda antes de la descripción extensa y la cobertura. Ver perfil sigue utilizando servicePublicHref con el contexto de búsqueda. Cuando no hay enlace autorizado, se muestra una explicación neutral. No se agrega carrito, agenda, reserva ni cobro.

## Profesional

Nombre público con un h1, avatar existente o icono de persona, descripción y localidad de referencia en una columna; localidades de trabajo y contacto en otra. Se diferencia ubicación de referencia de cobertura declarada. No se inventan especialidades: los servicios actualmente públicos muestran su categoría mediante las tarjetas existentes.

ProviderServices conserva íntegros su selección de localidad, filtro por providerId, paginación, consultas, totales y estados. No se amplía a búsquedas nacionales ni se presentan servicios fuera de la localidad elegida como disponibles allí. Se conserva la advertencia si la cobertura ya no coincide.

## Fotografías

Marco principal cuadrado 1:1, tamaño determinado por el contenedor, nunca por las dimensiones naturales de la foto. Fondo neutro, padding de 8 px, imagen centrada con contain, sin recorte ni deformación. Flyers verticales y fotos horizontales dejan márgenes internos cuando corresponde. No se modifican las reglas de catálogo.

Miniaturas de 64 px, desplazamiento horizontal dentro de su propia tira, selección con aria-pressed y foco visible. La selección usa la identidad estable de la foto, no su URL firmada, por lo que una renovación mantiene la selección. Sin fotografía o sin URL disponible se muestra un placeholder neutral; los errores/reintentos de firma originales permanecen.

Ampliar utiliza Dialog existente con cierre visible, Escape, foco modal nativo, retorno al disparador y botones Anterior/Siguiente si hay varias fotos. El visor limita su alto a 65dvh/700 px. ProductImage mantiene lazy loading y fallback originales. La galería no firma, persiste ni solicita datos: recibe las URLs que ya resuelven los hooks del dominio. La renovación en memoria continúa sin modificaciones.

## Contacto y privacidad

Únicamente se presentan datos de los DTO públicos existentes. No se agregan lecturas privadas, campos owner_id, emails Auth, notas administrativas, razones de moderación ni direcciones particulares de prestadores/vendedores.

Se conservan sin cambios las condiciones de WhatsApp: consentimiento/proyección pública existente, recepción de consultas, estado publicado, perfil activo y cobertura. usePublicServiceRecord continúa reconsultando al recuperar foco, conexión y periódicamente; durante la comprobación o tras un error no entrega datos a la presentación. No se agrega una garantía de verificación transaccional al hacer click: ese mecanismo no existe en el contrato actual y no se cambia en una etapa visual. WhatsApp sólo abre por acción del usuario.

## Retorno, carga y errores

Volver a resultados usa los helpers existentes que aceptan únicamente rutas internas conocidas del explorador. Conserva consulta, pestaña, filtros, páginas y contexto geográfico transmitidos; fallback seguro `/`. No se usa history.back.

Los reintentos de servicio y prestador conservan localidad, provincia, página del perfil y returnTo saneado. Artículos y productos conservan su retry actual con returnTo. Los not-found locales ofrecen retorno seguro sin distinguir falsamente vendido/pausado/retirado/bloqueado cuando el DTO no lo informa. Los errores públicos tienen separación entre título, mensaje y acciones. La comprobación remota de servicio/perfil reutiliza LoadingState.

## Responsive y accesibilidad

No hay nuevas barras fijas ni sticky: las acciones están dentro del documento, sin duplicarlas encima de MobileNav. Se conserva el padding inferior y safe-area global existente. Columnas minmax(0,1fr), descripciones que envuelven texto y botones móviles de ancho cómodo. Marco fotográfico estable al cargar.

Controles semánticos, nombres de fotos y botones, selección anunciada, foco visible, íconos decorativos ocultos cuando acompañan texto, y diálogo nativo reutilizado. Tokens de color, radios y spacing existentes; no hay animaciones nuevas.

## Archivos

Nuevos:
- src/components/details/detail-gallery.tsx
- src/components/details/detail-unavailable.tsx
- src/components/details/public-details.module.css
- src/app/producto/[id]/not-found.tsx
- UX_UI_DETAILS.md

Modificados:
- src/app/articulo/[id]/not-found.tsx
- src/app/servicio/[id]/not-found.tsx
- src/app/prestador/[id]/not-found.tsx
- src/app/producto/[id]/page.tsx
- src/app/articulo/[id]/page.tsx
- src/app/servicio/[id]/page.tsx
- src/app/prestador/[id]/page.tsx
- src/components/details/public-product-detail.tsx
- src/components/personal-listings/article-presentation.tsx
- src/components/personal-listings/public-article.tsx
- src/components/services/service-presentation.tsx
- src/components/services/public-service.tsx
- src/components/services/public-provider.tsx

No fue necesario cambiar UX_UI_GUIDELINES.md: se aplican sus reglas existentes mediante estilos acotados.

## Revisión manual pendiente

1. En 320/375/390/430/768/1440 px abrir los cuatro detalles; comprobar ausencia de overflow, títulos/precios largos, zoom 200 %, controles y final del contenido encima de MobileNav.
2. Probar flyer vertical, fotografía horizontal, cuadrada, ausencia y error de imagen. El marco no debe cambiar al cargar. Abrir visor, elegir miniaturas, Anterior/Siguiente, Escape y cerrar; revisar foco y Tab/Shift+Tab.
3. Comparar catálogo antes/después: no debe cambiar imagen, marco ni número de columnas por esta etapa.
4. Producto STOCKED positivo/cero, confirmación antigua/nula y ON_DEMAND disponible/no disponible. Agregar al pedido, favorito, tienda y WhatsApp deben conservar el flujo real; sin pagos reales.
5. Particular nuevo/usado, precio negociable, nombre largo, sin fotos y retiro/pausa desde otra sesión: al revalidar no debe mantenerse el contacto no público.
6. Servicio FIXED/FROM/QUOTE/null, sin fotos, consultas desactivadas y cobertura distinta: revisar etiquetas y que WhatsApp aparezca sólo bajo las condiciones existentes.
7. Profesional con/sin avatar, texto largo y varias coberturas. Llegar con localidad elegida, cambiar localidad y paginar: sólo servicios públicos de ese prestador y alcance.
8. Dejar abierta una galería hasta renovar firmas y volver de otra pestaña; comprobar que mantiene la selección y los reintentos existentes recuperan fotos fallidas.
9. Abrir desde búsqueda con query, pestaña, filtros y página; volver y reintentar después de desconexión. El contexto debe conservarse. Probar returnTo externo/manipulado y UUID inexistente/inválido: retorno interno seguro y ningún contacto privado.
10. Comprobar formularios/vistas privadas de artículo, perfil y servicio: publicDetail no está activado allí y siguen usando su presentación previa.

## Limitaciones

Revisión estática, sin afirmar PASS de runtime, accesibilidad o responsive. No se mejora resolución de archivos originales. No se agregan fotos comerciales que Product no entrega, reputación ni disponibilidad garantizada. Los contactos conservan la ventana de revalidación existente; un cambio remoto entre lecturas no se vuelve una operación atómica por este rediseño. El manejo HTTP de notFound sigue la convención instalada de Next.js (incluida su diferencia entre respuestas transmitidas y no transmitidas). UX/UI 5 no se inició.

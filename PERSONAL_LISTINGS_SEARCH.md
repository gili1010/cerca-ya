# CercaYa 2.0 — integración pública de particulares (Prompt 4)

## Alcance

Home/explorador incorpora **Todo**, **Comercios** y **Particulares**. Todo es
el modo inicial y presenta secciones independientes: Productos de comercios
y Publicaciones de particulares. Guardados conserva su funcionamiento comercial.
El Prompt 7 añade Servicios como cuarto dominio y tercera sección independiente
en Todo; ver [SERVICES_SEARCH.md](SERVICES_SEARCH.md). Las nuevas elecciones
manuales de localidad se conservan entre particulares y servicios, sin cambiar
el alcance comercial. Los filtros y RPC particulares permanecen independientes.

Texto y categoría se comparten. La categoría se resuelve de slug a UUID de las
categorías existentes para la RPC particular; una categoría desconocida no se
convierte silenciosamente en “todas”. El selector particular permite acceder
también a categorías que no están destacadas en la Home.

Los grupos comerciales conservan sus propios totales, páginas, radio, filtros,
orden y componentes. Particulares usa 24 resultados por página, total y
paginación independientes. No hay mezcla de arrays, orden global, descarga
completa ni filtrado local de resultados.

## Backend y privacidad

Se reutilizan `readPersonalListings` → `read_personal_listings_page` y
`readPublicPersonalListing` / `getPublicPersonalListing` →
`read_public_personal_listing`. No se modifican RPC comerciales, tablas,
Storage, RLS ni SQL. **No hay SQL adicional pendiente**: el usuario confirmó
los tres deltas particulares ya aplicados.

La RPC pública filtra PUBLISHED, vencimiento, bloqueo administrativo y suspensión
del propietario. SOLD, PAUSED, WITHDRAWN y DRAFT no son resultados disponibles.
Se conserva el parseo explícito del DTO público, sin owner_id, coordenadas,
perfil/Auth ni información administrativa. Los contactos del DTO siguen sujetos
al consentimiento existente; las tarjetas no los muestran.

Los resultados se reconsultan al volver a la pestaña, recuperar conexión,
alcanzar el vencimiento de un artículo y cada minuto mientras la página está
visible. No se añade Realtime ni se escribe nada al buscar. Cambios de filtros
cancelan solicitudes anteriores y las respuestas atrasadas no reemplazan las
actuales. Una página que queda fuera del total ofrece volver a la primera.

La analítica comercial sigue midiendo sólo resultados comerciales con intención
explícita. No registra búsquedas exclusivas de particulares ni incorpora sus
totales; restaurar la URL o recargar no genera una medición adicional.

## Ubicación y filtros

Particulares requiere localidad y provincia argentinas. Usa la localidad
canónica del comprador cuando existe, aunque tenga GPS. Si falta, muestra
“Elegir localidad” y no consulta nacionalmente. Una elección explícita queda
en la URL y puede reutilizarse para servicios: no cambia la ubicación del comprador,
coordenadas, radio ni fallback comercial.

Se reutiliza el formulario de provincia/localidad con sugerencias Geoapify
opcionales. Si no hay proveedor o falla, se permite escribir el nombre completo,
que debe coincidir con la localidad del anuncio según la normalización del
backend. No se inventan coordenadas, centroides ni distancias.

Filtros particulares: texto, categoría, localidad, provincia, Nuevo/Usado,
Más recientes, precio ascendente y descendente. No se aplican stock, hoy,
retiro, envío ni radio. “Lo necesito hoy” selecciona el dominio comercial.

## Fotografías y detalle

Cada tarjeta muestra foto principal (posición 0), título, precio, condición,
localidad/provincia y distintivo Particular. No tiene carrito, reserva ni tienda.

`useSignedPersonalPhotos` firma sólo las fotos principales de la página actual,
en el bucket privado existente. URLs únicamente en memoria, con renovación
previa al vencimiento y al recuperar foco/conexión. Una falla deja placeholder
y reintento, sin bloquear los demás artículos. No se firman las fotos de páginas
no consultadas; al abrir el detalle se reutiliza su galería completa existente.

La tarjeta abre `/articulo/[id]` con un `returnTo` que captura parámetros
conocidos, página y localidad utilizada, sin coordenadas ni URLs firmadas.
La ruta valida que el retorno sea exclusivamente `/` de CercaYa y elimina
parámetros desconocidos; no admite destinos externos. “Volver a los resultados”
restaura esa URL con ancla en particulares. El contacto ahora dice
**Consultar al vendedor**, conservando el WhatsApp autorizado. No se agrega
un formulario de reporte nuevo; este detalle todavía no tenía uno.

Parámetros agregados: `domain` (all/businesses/personal), `personal_page`
(base cero), `condition` (NEW/USED), `personal_sort`
(newest/price_asc/price_desc), `personal_locality`, `personal_province`.
Cambiar de dominio conserva los filtros y páginas; cambiar texto/categoría
reinicia las páginas correspondientes. Condición, orden y localidad particulares
reinician sólo su página. Los parámetros comerciales anteriores se conservan.

## Archivos de esta etapa

- `src/components/marketplace.tsx`: selección de dominio e integración.
- `src/components/home/catalog.tsx`: título identificable en Todo.
- `src/lib/search-navigation.ts`: estado adicional y retorno interno seguro.
- `src/lib/personal-listings/use-public-listings.ts`: lectura paginada pública.
- `src/components/personal-listings/personal-search.tsx`: filtros/resultados.
- `src/components/personal-listings/public-listing-card.tsx`: tarjeta particular.
- `src/components/personal-listings/personal-search.module.css`: estilos mínimos.
- `src/app/articulo/[id]/page.tsx`: retorno validado para el detalle existente.
- `src/components/personal-listings/public-article.tsx`: volver a resultados.
- `src/components/personal-listings/article-presentation.tsx`: texto de contacto.
- `PERSONAL_LISTINGS_FRONTEND.md`: referencia a esta integración.
- `PERSONAL_LISTINGS_SEARCH.md`: esta documentación.

## Pruebas manuales pendientes

No se ejecutaron tests, lint, TypeScript, build, navegador, servidores ni SQL.
La revisión realizada es por lectura de contratos, funciones SQL locales y diff;
no acredita compilación ni comportamiento efectivo en navegador.

1. Publicar dos artículos QA en la misma localidad, uno Nuevo y otro Usado,
   con distintas categorías/precios. Preparar también un producto comercial
   con un término común, sin alterar productos reales.
2. En Home, con localidad conocida, comprobar Todo: grupos identificados,
   precios/condiciones y ausencia de carrito/stock/distancias en particulares.
3. Buscar el término común y alternar los tres dominios. Comprobar filtros
   comerciales, favoritos, detalle comercial, tienda y carrito habituales.
4. En Particulares probar categorías, condición y los tres órdenes. Recargar
   y comprobar URL. Con más de 24 anuncios QA, cambiar de página, abrir uno,
   volver a resultados y comprobar página/filtros/localidad conservados.
5. Sin ubicación, confirmar que no aparecen resultados nacionales. Elegir
   provincia/localidad manualmente sin conceder GPS. Cambiar a otra localidad
   y verificar que no cambió la ubicación/radio comercial.
6. Probar búsqueda sin coincidencias, categoría desconocida en URL, conexión
   interrumpida y reintentos. Una falla comercial no debe impedir particulares
   y viceversa; una foto fallida debe dejar una tarjeta utilizable.
7. Mantener la pantalla más de diez minutos y volver desde segundo plano:
   comprobar renovación de fotos. Navegar entre páginas: sólo sus principales
   deben firmarse. Probar también visitante sin sesión y cambio de cuenta.
8. Pausar/vender/retirar un anuncio QA desde otra pestaña: confirmar que
   desaparece al recuperar foco o en la próxima reconsulta. Probar vencimiento,
   bloqueo y suspensión sólo con cuentas/datos QA autorizados.
9. Abrir el detalle y “Consultar al vendedor”. Verificar el retorno al explorador
   y que `returnTo=https://...`, `//...` o una ruta ajena no salga de la Home.
10. Revisar celular y teclado: controles, foco, dos columnas de tarjetas,
    títulos/precios largos, cambio de localidad y paginación sin overflow.
11. Confirmar que refresh y una búsqueda sólo particular no agregan eventos a
    la analítica comercial; Todo/Comercios siguen informando sólo sus totales.

Servicios, ranking unificado y analítica específica de particulares quedan
fuera de esta etapa.

# CercaYa 2.0 — Servicios en el explorador (Prompt 7)

## Estado de esta entrega

Implementación revisada por lectura de código, contratos, firmas SQL y diff.
No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni
despliegues. No se instalaron dependencias. No se declara validación en ejecución.
El usuario confirmó instalados los tres SQL de servicios: no hay SQL adicional.

## Auditoría breve y arquitectura

- `marketplace.tsx` conserva una barra de búsqueda y el estado de URL existente.
  Se amplía `all | businesses | personal` con `services`. Guardados sigue siendo
  exclusivamente comercial. Los filtros y consultas comerciales no se reemplazan.
- `home/catalog.tsx` mantiene sus grupos de distancia/localidad, filtros, totales
  y páginas. No consulta servicios. En Todo conserva el título comercial explícito.
- `personal-search.tsx` conserva consulta, condición, categorías de productos,
  ordenamiento, fotos, detalle y páginas. No incorpora categorías de servicios.
- `search-navigation.ts` añade parámetros propios, conserva los anteriores y
  amplía el retorno interno permitido para incluir la sección de servicios.
- `services/client.ts`, `server.ts`, `contracts.ts`, `types/services.ts` ya
  coinciden con las firmas SQL instaladas. Los lectores siguen reconstruyendo
  DTO públicos, sin trasladar campos desconocidos o administrativos.
- `ServiceSearch` agrega una sección independiente. Reutiliza `ArticleLocality`,
  `ServiceCard`, `servicePriceLabel`, `ProductImage` y `useSignedServicePhotos`.
  Los detalles y perfiles siguen en sus rutas existentes.

Todo presenta productos de comercios, publicaciones particulares y servicios y
oficios en secciones separadas. Cada una conserva carga, error, vacío, total y
página independientes. Servicios muestra hasta 12 resultados por página, tanto
en Todo como en Servicios, para conservar el significado del número de página.
No se mezclan arrays ni se construye un ranking global. No hay descarga completa.
El error de servicios no impide mostrar los demás dominios.

## RPC y contratos

| Uso | RPC | Argumentos |
| --- | --- | --- |
| Grupos y especialidades activos | `read_service_categories` | Sin argumentos |
| Resultados principales | `read_service_listings_page` | `p_locality`, `p_province_code`, `p_query`, `p_category_id`, `p_provider_id: null`, `p_offset`, `p_limit: 12` |
| Servicios dentro del perfil | `read_service_listings_page` | Misma firma, `p_provider_id` del perfil, `p_limit: 24` |
| Detalle público | `read_public_service_listing` | `p_listing_id` |
| Perfil público | `read_public_service_provider` | `p_provider_id` |

`read_service_providers_page` y su lector existente permanecen disponibles y
compatibles. No se añade una segunda consulta de prestadores al explorador: los
resultados principales son servicios y cada tarjeta enlaza al prestador. Así no
se cuenta al mismo profesional como otro servicio ni se duplican totales.

La respuesta de resultados es `{ items, total, offset, limit }`, validada por los
parsers existentes. El offset es página por tamaño. La URL limita páginas a
100000; el helper mantiene su comprobación de entero seguro y límite SQL integer.
Una página que queda fuera del total ofrece volver a la primera sin ampliar filtros.

## Filtros y búsqueda de oficios

Sólo se envían texto, grupo/especialidad y localidad/provincia. Las opciones se
obtienen de la taxonomía real: Construcción y mantenimiento, Hogar y jardín,
Reparaciones, Educación y Transporte, con sus especialidades activas. El selector
agrupa las opciones y permite elegir el grupo completo por su UUID. Una categoría
desconocida/deshabilitada no se sustituye por todas ni se envía como UUID inválido.

No hay filtrado de resultados en frontend por precio, modalidad, horario,
reputación o distancia. La categoría comercial queda guardada pero no filtra
servicios. Cambiarla no reinicia la página de servicios; cambiar el texto sí.

El texto se envía sin equivalencias inventadas a PostgreSQL. El backend existente
normaliza acentos/case y busca título/descripción, categoría/grupo y diccionario
relacional de términos. Allí están electricista, plomero, albañil, cortar pasto,
arreglar lavarropas y profe particular. Los términos alternativos son expresiones
curadas, no una inferencia semántica arbitraria. Sólo habrá resultados si existen
servicios públicos elegibles en esa cobertura y categoría.

## Localidad y cobertura

Prioridad del explorador de servicios:

1. Localidad/provincia explícitas de servicios en la URL.
2. Elección compatible existente de particulares, si está completa.
3. Localidad canónica del comprador con provincia argentina válida.
4. Si falta, selector manual: no se realiza consulta nacional.

Una nueva elección manual en particulares o servicios se conserva para ambos
dominios basados en localidad y reinicia sus páginas. Sus categorías y filtros
siguen separados. Esto nunca modifica GPS, ubicación canónica, radio, distancias
ni fallback comercial. Volver a la localidad actual elimina los overrides.

El backend exige coincidencia de provincia/localidad normalizada en
`service_areas`, no en la localidad de referencia del profesional. No requiere
GPS ni coordenadas domiciliarias. Un prestador de Anisacate que declaró Alta
Gracia aparece allí; uno que no la declaró no aparece. REMOTE respeta exactamente
esa misma cobertura en esta etapa.

Los enlaces guardan la localidad efectiva, aunque proviniera del estado canónico.
El perfil consulta únicamente servicios de ese prestador en esa localidad. Si
dejó de cubrirla, no cae en otra: muestra el aviso y permite elegir expresamente
otra de sus zonas. Un perfil abierto directamente, sin contexto ni localidad
conocida, selecciona y muestra una localidad declarada; nunca consulta nacionalmente.
La selección y página del perfil también quedan en su URL.

## Estado de solicitudes y rendimiento

- La sección se mantiene montada al alternar pestañas; sus categorías se reutilizan
  en memoria. Sólo consulta resultados cuando es visible, tiene localidad válida
  y la categoría está resuelta.
- Debounce de 300 ms. Cambios de texto, categoría, localidad, página o pestaña
  abortan la solicitud anterior; las respuestas tardías se ignoran.
- Cada respuesta lleva la clave de sus criterios. Un cambio de alcance oculta
  inmediatamente los resultados anteriores, antes del siguiente efecto.
- Reenviar el buscador vuelve a consultar incluso con el mismo texto. Volver a
  Servicios, recuperar conexión o foco también reconsulta. No se agrega Realtime,
  polling global, suscripciones ni mediciones nuevas de analítica.
- La analítica comercial existente conserva únicamente sus resultados comerciales;
  no se le suman servicios ni se genera un evento al restaurar la URL.

## Tarjetas, imágenes y contacto

`ServiceCard` admite enlaces contextualizados sin cambiar su uso privado. Muestra
foto principal opcional, título, categoría, distintivo Servicio, precio, prestador
y resumen de sus localidades declaradas. El prestador es clickeable. Sin foto,
usa un ícono relacionado con la categoría o una herramienta neutra; no fotos falsas.

FIXED muestra moneda ARS; FROM, «Desde …»; QUOTE, «A presupuestar». Nunca $0 para
QUOTE. No hay carrito, stock, reserva comercial, kilómetros ni credenciales ficticias.

El explorador firma sólo las fotos principales de su página, mediante el helper
existente de `service-images` privado. Las firmas viven en memoria y se renuevan
antes del vencimiento (TTL 600 s), al recuperar conexión y al volver al foco si
corresponde. No se guardan URLs firmadas en URL, base ni localStorage. El detalle
firma sólo su galería y avatar. Una imagen fallida conserva el título/enlaces y
placeholder; el aviso permite reintentar fotos sin bloquear las tarjetas.

El WhatsApp permanece en los detalles/perfiles existentes, con DTO públicos y
reconsulta de elegibilidad. Las tarjetas no muestran teléfonos. Servicio pausado,
retirado, bloqueado, prestador inactivo/bloqueado, propietario suspendido o categoría
deshabilitada quedan excluidos por el backend. Un servicio público que no acepta
consultas puede aparecer, pero no muestra contacto. En el perfil el contacto
mantiene la autorización pública propia del backend (algún servicio elegible que
acepte consultas); no se reutiliza como teléfono de un servicio cerrado a consultas.
Además se oculta el contacto si el contexto explícito ya no está cubierto.
No se consulta Auth, owner_id, contactos privados ni datos de moderación.

## URLs y regreso

Se preservan `q`, `domain`, parámetros comerciales y particulares existentes.
Servicios añade:

- `service_category`: UUID de grupo o especialidad.
- `service_locality` / `service_province`: cobertura elegida.
- `service_page`: página cero-based del explorador.
- `provider_page`: página cero-based interna del perfil.

Detalle y perfil reciben `returnTo` con la URL del explorador, más localidad y
provincia explícitas. El enlace al prestador y sus tarjetas propagan ese contexto.
«Volver a los resultados» restaura texto, pestaña, filtros y páginas. Atrás del
navegador también conserva la URL previa. El retorno sólo admite pathname `/`,
parámetros conocidos y anclas del explorador: rechaza URLs externas, `//`, barras
invertidas y controles. No se usa un redirect recibido sin validar.

## Archivos de esta etapa

Nuevos:
- `src/components/services/service-search.tsx`
- `src/components/services/service-search.module.css`
- `src/lib/services/search-navigation.ts`
- `SERVICES_SEARCH.md`

Modificados:
- `src/components/marketplace.tsx`
- `src/components/home/hero.tsx` (placeholder/labels incluyen servicios)
- `src/lib/search-navigation.ts`
- `src/components/services/service-card.tsx`
- `src/components/services/service-presentation.tsx`
- `src/components/services/public-service.tsx`
- `src/components/services/public-provider.tsx`
- `SERVICES_SETUP.md`, `SERVICES_FRONTEND.md`, `PERSONAL_LISTINGS_SEARCH.md`

No se modifican SQL, RLS, contratos RPC, backend, carrito ni reservas.

## Pruebas manuales pendientes

1. Publicar servicios QA en distintas especialidades, con y sin foto; precios FIXED,
   FROM y QUOTE. Declarar referencia Anisacate y cobertura Alta Gracia + Anisacate.
2. En Home alternar Todo/Comercios/Particulares/Servicios, en móvil y escritorio.
   Confirmar búsqueda única, secciones independientes y Guardados comercial.
3. Sin localidad guardada, comprobar que no se busque nacionalmente. Elegir Córdoba
   y Alta Gracia manualmente. Cambiar de pestaña y comprobar la selección compatible.
4. Buscar electricista, plomero, albañil, cortar pasto, arreglar lavarropas y profe
   particular. Probar acentos y mayúsculas sobre servicios QA públicos existentes.
5. Elegir cada grupo y luego una especialidad; comprobar que filtros comerciales,
   precio/condición de particulares y páginas no se mezclen con servicios.
6. Buscar en Alta Gracia: aparece quien la cubre aunque viva en Anisacate. Elegir
   una localidad no declarada y comprobar que no aparezca. Repetir con REMOTE.
7. Con más de 12 servicios elegibles, paginar; abrir detalle, perfil y otro servicio;
   volver a resultados y recargar: conservar texto, categoría, localidad y página.
   Probar también la paginación de 24 servicios dentro del perfil.
8. Cambiar rápidamente texto/localidad/página, o pasar de pestaña durante una
   petición lenta. No deben reaparecer resultados del alcance anterior.
9. Simular fallo de búsqueda de servicios y reintentar: otros dominios siguen
   disponibles. Probar categoría inexistente en URL y página fuera de rango.
10. Abrir sin sesión los detalles; verificar sólo datos públicos. Desactivar
    consultas: la tarjeta queda visible sin WhatsApp en su detalle. Pausar/retirar
    o moderar un servicio y reenviar la búsqueda; no debe aparecer ni abrirse como
    disponible. Si se retira cobertura, el perfil no debe elegir otra silenciosamente.
11. Esperar renovación de firma, volver al foco, recuperar conexión y simular foto
    fallida; las tarjetas deben continuar utilizables y permitir reintento.
12. Probar `returnTo=https://example.com`, `//example.com`, rutas ajenas al explorador
    y parámetros desconocidos: el retorno debe quedar en Home sin redirect externo.
13. Regresión manual de productos, favoritos, tiendas, carrito, reservas, particulares,
    publicación/edición de servicios, Pedido Abierto y Radar existentes.

## Límites conocidos

Validación de compilación y ejecución pendiente por instrucción del usuario.
La coincidencia geográfica sigue siendo textual canónica del backend; no incorpora
nuevas localidades equivalentes ni geocodificación obligatoria. Los aliases de
oficios cubren términos curados existentes, no cualquier expresión libre.
No hay búsqueda nacional, ranking mixto, filtros extra, conteo separado de
prestadores, Realtime público ni Radar de servicios. Cambios públicos en otra
pestaña se reflejan al reconsultar, no mediante push.

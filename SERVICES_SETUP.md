# CercaYa 2.0 — Servicios: backend, primera etapa

## Estado y alcance

El usuario confirmó que ejecutó correctamente `services.sql`,
`services-access.sql` y `services-moderation.sql`, junto con su verificación.
No es necesario volver a ejecutarlos. Codex no ejecutó SQL remoto ni validaciones
automáticas; la confirmación de instalación proviene del usuario.

El frontend del Prompt 6 ya está implementado sobre ese backend. Ver
[SERVICES_FRONTEND.md](SERVICES_FRONTEND.md) para rutas, inventario y pruebas
manuales. El Prompt 7 integra servicios al explorador; ver
[SERVICES_SEARCH.md](SERVICES_SEARCH.md). No incorpora Realtime,
stock, carrito, reservas, turnos, pagos ni Radar de servicios.

## Orden de instalación (referencia para un entorno nuevo)

Ejecutar manualmente, una sola vez, como postgres en Supabase SQL Editor:

1. `supabase/services.sql`
2. `supabase/services-access.sql`
3. `supabase/services-moderation.sql`

Esperar Success de cada archivo antes del siguiente. Cada uno es transaccional.
No reejecutar archivos ya aplicados; no se reescribieron migraciones históricas.

Prerrequisitos existentes: profiles, private.user_suspensions,
private.require_active_marketplace_user, private.require_admin,
private.argentina_province_name, private.normalize_search_query inmutable
y Storage Supabase. El primer delta falla si faltan. El segundo crea
service-images privado; si ya existe con configuración diferente, falla
sin cambiar silenciosamente ese bucket.

La ejecución en el entorno actual ya fue confirmada. El frontend no añade SQL.

## Modelo y decisiones

| Tabla | Función / relaciones |
| --- | --- |
| public.service_providers | Un perfil por profiles.id mediante UNIQUE(owner_id); nombre público, presentación, avatar, active, revisión y bloqueo. |
| public.service_categories | Grupos/subcategorías independientes con parent_id; IDs UUID y slugs de semilla permanentes. |
| public.service_listings | Varios servicios del prestador, categoría propia, modalidad, precio, estado y acepta consultas. |
| public.service_listing_images | Hasta cinco relaciones ordenadas por servicio; posición 0 principal; ruta privada de Storage. |
| public.service_areas | Hasta treinta localidades declaradas por prestador; UNIQUE por prestador/provincia/localidad normalizada. |
| private.service_provider_locations | Localidad/provincia de referencia; sin domicilio ni coordenadas. |
| private.service_provider_contacts | WhatsApp y consentimiento explícito; no copia perfiles/Auth. |
| private.service_reports | Reportes de prestadores o servicios, estado/revisión, sin acceso directo del cliente. |
| private.service_audit_logs | Acciones administrativas propias, sin cambiar auditorías existentes. |
| private.service_category_search_terms | Términos alternativos curados, vinculados por FK a categorías/grupos; sólo mantenimiento privilegiado. |

Una cuenta conserva todas sus capacidades existentes. No se crea business_id,
tienda obligatoria ni rol exclusivo. El prestador puede activarse/desactivarse
con la misma RPC de perfil. Desactivar oculta sus servicios; reactivar conserva
los estados anteriores, sin convertir PAUSED/WITHDRAWN en PUBLISHED.

Modalidad del servicio: ONSITE (a domicilio/en el lugar coordinado),
AT_PROVIDER (en el lugar del prestador, sin publicar dirección),
REMOTE (remoto). Incluso REMOTE se descubre sólo en localidades declaradas;
no hay cobertura nacional implícita.

Precio: FIXED / FROM exigen importe positivo con hasta dos decimales; QUOTE
exige NULL. No se usa cero como “a presupuestar”. Moneda ARS.
Estados: DRAFT → PUBLISHED/ WITHDRAWN;
PUBLISHED → PAUSED/ WITHDRAWN; PAUSED → PUBLISHED/ WITHDRAWN.
WITHDRAWN es terminal. Pausar no borra datos. accepting_inquiries es independiente:
un PUBLISHED puede seguir visible sin aceptar consultas, pero su DTO de servicio
oculta WhatsApp. El perfil público muestra contacto sólo si tiene algún servicio
público que acepte consultas.

Las imágenes de trabajos son opcionales para publicar; no se obliga a inventar
una foto o usar un logo. Se exigen categoría activa, prestador activo,
contacto autorizado y al menos una localidad declarada.

Taxonomía inicial: cinco grupos, veinte especialidades, incluyendo aire
acondicionado. Se publican especialidades de segundo nivel y se puede buscar por
especialidad o grupo. Agregar categorías futuras requiere conservar IDs/slugs
existentes; no hay edición de categorías desde cliente en esta etapa.

## Cobertura

Referencia del perfil y cobertura son datos separados. Un prestador con
referencia Anisacate y área Alta Gracia aparece al buscar Alta Gracia. No aparece
en otra ciudad si no la declaró.

Todas las RPC de búsqueda pública exigen localidad + provincia AR válida;
no hay fallback nacional, GPS, radio ni distancias. Igual que particulares,
la provincia usa catálogo oficial del proyecto y la localidad es texto
normalizado (acentos/case/espacios) con coincidencia exacta. No hay padrón nacional
de ciudades: el frontend posterior deberá reutilizar sugerencias canónicas y
evitar variantes como La Bolsa/Villa La Bolsa. No se fabrican equivalencias.

La lista es compartida por todos los servicios del prestador en esta etapa.
Cambiar cobertura actualiza todos; revisión del perfil evita sobrescritura.
coverage_type=LOCALITY deja explícito el tipo. Un radio futuro requerirá un delta
y consentimiento/punto adecuados: no se crean campos GPS ni centroides ahora.

## RPC preparadas

### Gestión y lectura propia (authenticated)

- save_my_service_provider(p_input jsonb, p_provider_id uuid, p_expected_revision bigint DEFAULT NULL).
- set_my_service_areas(p_provider_id uuid, p_areas jsonb, p_expected_revision bigint).
- save_my_service_listing(p_provider_id uuid, p_listing_id uuid, p_input jsonb, p_expected_revision bigint DEFAULT NULL).
- manage_my_service_listing(p_listing_id uuid, p_action text, p_expected_revision bigint).
- set_my_service_listing_images(p_listing_id uuid, p_paths text[], p_expected_revision bigint).
- set_my_service_provider_avatar(p_provider_id uuid, p_path text, p_expected_revision bigint); NULL retira referencia.
- read_my_service_provider().
- read_my_service_listings(p_listing_id uuid DEFAULT NULL, p_status text DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24).

Las mutaciones devuelven el UUID salvo Admin. La creación recibe UUID del caller:
conservarlo durante respuestas inciertas, leer el propio registro y reconciliar
antes de repetir. UNIQUE(owner_id) y bloqueo por cuenta previenen perfiles
duplicados. Creaciones no aceptan revisión; actualizaciones exigen la actual.

### Público (anon/authenticated)

- read_service_categories().
- read_public_service_provider(p_provider_id uuid).
- read_public_service_listing(p_listing_id uuid).
- read_service_listings_page(p_locality text, p_province_code text, p_query text DEFAULT '', p_category_id uuid DEFAULT NULL, p_provider_id uuid DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24).
- read_service_providers_page(p_locality text, p_province_code text, p_query text DEFAULT '', p_category_id uuid DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24).

Páginas: {items, total, offset, limit}, máximo 50, orden estable por fecha/id.
Detalle no disponible devuelve NULL. Buscar servicios aplica texto a título,
descripción, nombre de categoría/grupo y términos alternativos explícitos.
Buscar prestadores también contempla nombre/presentación, con
categoría y servicio público elegible. Cobertura usa EXISTS, sin duplicar un
prestador por múltiples servicios/áreas. Filtros y paginación en PostgreSQL.
GIN de texto y B-tree de cobertura/categoría/fecha/propiedad.

### Búsqueda por oficio y expresiones habituales

`private.service_category_search_terms` contiene expresiones, su normalización,
categoría FK y bandera active. La clave evita repetir un término normalizado
dentro de una categoría. Un índice parcial permite buscar términos activos por
igualdad; no hay acceso directo de anon/authenticated ni RPC para editarlo.
Se amplía posteriormente con SQL privilegiado, sin tocar publicaciones,
catálogo comercial ni particulares. Un término de grupo se hereda a sus
especialidades; no se heredan términos de categorías hermanas.

`private.service_search_category_ids` resuelve una sola vez por consulta los
IDs de especialidades activas cuyo nombre/grupo coincide por FTS o cuyo término
alternativo coincide con la expresión completa normalizada. Las dos RPC públicas
combinan esos IDs con la búsqueda textual existente, manteniendo filtros de
categoría, cobertura, elegibilidad y paginación. No cambian firmas ni DTO.

| Expresión | Categoría relacionada |
| --- | --- |
| electricista | Electricidad |
| cortar pasto | Corte de pasto |
| plomero | Plomería |
| albañil | Albañilería |
| arreglar lavarropas | Electrodomésticos |
| profe particular | Clases particulares |

Nombres de categorías/grupos y título/descripción conservan palabras/prefijos
normalizados (todas las palabras deben coincidir en ese documento). Los términos
alternativos usan igualdad de la expresión completa, sin fuzzy matching ni IA.
No se mezclan palabras de aliases distintos: “arreglar” por sí solo no se
expande a todas las reparaciones, ni “cortar lavarropas” combina aliases.
“Electricista urgente” necesitará coincidencia textual en el servicio o una
expresión curada adicional; no se ignora “urgente” para ampliar resultados.

La relación es de categoría, no de capacidad individual verificada: “arreglar
lavarropas” encuentra servicios declarados como Electrodomésticos, pero no
garantiza que cada prestador repare ese aparato. La siguiente pantalla debe
mostrar claramente título/categoría y permitir consultar el alcance.

Los nombres y términos se leen actuales en cada búsqueda; no requieren reindexar
todos los servicios ni actualizar sus revisiones cuando cambia el diccionario.
Si crece mucho la taxonomía, medir rendimiento antes de agregar una arquitectura
de búsqueda diferente.

### Cupo de publicaciones

Máximo 20 servicios **no retirados** por prestador: DRAFT, PUBLISHED y PAUSED
consumen cupo, incluso si están bloqueados administrativamente. WITHDRAWN no
consume cupo y sigue siendo terminal. Se eliminó el límite histórico de 100:
se puede crear una publicación nueva después de retirar otra, sin borrar historia.

`save_my_service_listing` obtiene primero el prestador con FOR UPDATE mediante
`own_service_provider`, y conserva el bloqueo hasta terminar la transacción.
Creación y retiro usan el mismo padre: solicitudes concurrentes se serializan;
la segunda creación vuelve a contar después de la primera, antes de insertar.
La validación de UUID, propiedad, suspensión y revisión permanece intacta.
Un índice parcial por prestador, sólo de no retirados, mantiene acotado el conteo
de cupo aunque crezca el historial de WITHDRAWN.
No se agregaron controles nuevos de spam. Un límite temporal de altas, con
parámetros y monitoreo acordados, puede evaluarse en otra etapa.

### Reportes y Admin (authenticated; autorización Admin dentro de PostgreSQL)

- report_service(p_entity text, p_id uuid, p_reason text, p_details text DEFAULT '').
- admin_set_service_block(p_entity text, p_id uuid, p_blocked boolean, p_expected_revision bigint, p_reason text DEFAULT '', p_note text DEFAULT '').
- admin_resolve_service_report(p_report_id uuid, p_status text, p_expected_revision bigint, p_note text DEFAULT '').
- admin_read_services(p_section text, p_provider_id uuid DEFAULT NULL, p_listing_id uuid DEFAULT NULL, p_status text DEFAULT NULL, p_offset integer DEFAULT 0, p_limit integer DEFAULT 24).

entity: provider/listing. section: providers/listings/reports/audit.
En providers el estado es ACTIVE/INACTIVE; en listings estados del servicio;
en reports OPEN/RESOLVED/DISMISSED; audit no acepta status.
Reportes: cuenta activa, objetivo público, no autoreporte, uno abierto por
cuenta/objetivo, máximo diez nuevos por día entre ambos tipos.
Admin exige motivo al bloquear y revisión actual. Bloquear prestador oculta todo;
bloquear servicio oculta sólo ese servicio. Desbloquear conserva active/status
y jamás elude suspensión de cuenta. Auditoría en la misma transacción.

No se añade insignia de verificación/matrícula ni se modifica el panel existente.

## RLS, concurrencia y privacidad

RLS en todas las tablas. SELECT base sólo propio en providers/listings/images/areas.
Sin INSERT/UPDATE/DELETE cliente; escrituras exclusivamente RPC security definer
con search_path vacío y validación de claves/tipos/valores. Categorías se leen
por RPC, contacto/ubicación/moderación privados sin grants directos.

Mutaciones usan require_active_marketplace_user, propiedad y bloqueo. Bloqueo
de cuenta existente comparte bloqueo de Auth con la escritura. Orden de bloqueos
del módulo: cuenta → prestador → servicio. Storage y gestión de referencias
también bloquean esos padres. Revisiones incrementan en PostgreSQL; edición,
cobertura, fotos, avatar y moderación rechazan revisiones viejas con SERVICE_CHANGED.
Estados/transiciones, contactos, importes, referencias y publicación final tienen
restricciones/triggers de DB. Los reportes y auditoría tienen FK que garantizan
que el servicio corresponda al prestador indicado.

Suspender la cuenta oculta prestador/servicios y bloquea escrituras/fotos sin
cambiar estados de este módulo. El propietario puede leer sus datos para
entender su situación, pero no editarlos mientras esté suspendido/bloqueado.
Los helpers administrativos existentes mantienen su autorización.

DTO públicos construidos campo por campo; sin owner_id, revisión administrativa,
bloqueos, Auth, domicilio ni GPS. Parsing TypeScript explícito descarta claves
desconocidas. Teléfono solamente consentido. Funciones SSR/Admin llevan
server-only, cliente con cookies del solicitante, sin secret key ni cache
compartida. Logs Admin sólo operación/código, sin contactos/notas/secrets.

## Storage y fotos

Bucket privado service-images: JPEG/WebP, máximo 2 MiB por objeto.
Rutas:
- providers/{providerUUID}/{imageUUID}.jpg|webp (avatar).
- listings/{listingUUID}/{imageUUID}.jpg|webp (trabajos).

Policy SELECT: dueño o archivo vinculado a entidad pública elegible.
INSERT: cuenta activa, padre propio no bloqueado, formato válido, cuota.
DELETE: mismas guardas y objeto sin referencia. UPDATE/upsert prohibido.
Policies restrictivas cierran el bucket aunque exista otra policy permisiva
genérica; fuera de este bucket no modifican acceso actual.

Cinco fotos vinculadas + cinco temporales por servicio; un avatar + una versión
temporal por prestador. Reemplazo: subir ruta nueva → RPC con revisión para
registrar → releer/reconciliar → borrar sólo versiones no vinculadas por Storage
API. Nunca DELETE SQL sobre storage.objects.

Se reutiliza compressPhoto. ServiceUploadError conserva objectPath si no se
conoce resultado. saveServiceListingPhotos/saveServiceProviderPhoto devuelven
success/uncertain/current/pendingCleanup/message. Conflicto o relectura incierta
no dispara borrado compensatorio. cleanupServicePhotos revalida referencias;
readUnattachedServicePhotos permite recuperar temporales tras recargar.
No ejecutar una limpieza ciega mientras otra pestaña está trabajando.

signServicePhotos devuelve URLs en memoria, errores por archivo y expiresAt
(TTL diez minutos). El frontend futuro debe renovar antes del vencimiento
y al volver a foco/conexión; no hay hook/pantalla todavía. No persistir firmas.
Al bloquear/retirar se deniegan nuevas firmas; las ya emitidas pueden funcionar
hasta expirar. No hay revocación instantánea de una URL firmada.

## Archivos de esta etapa

Nuevos:
- supabase/services.sql
- supabase/services-access.sql
- supabase/services-moderation.sql
- src/types/services.ts
- src/lib/services/contracts.ts
- src/lib/services/client.ts
- src/lib/services/server.ts
- src/lib/services/admin.ts
- src/lib/services/images.ts
- SERVICES_SETUP.md

Modificado en la implementación inicial: src/types/database.ts (contratos adicionales únicamente).
Se preservaron los cambios previos del working tree y los módulos comerciales/
particulares, pantallas y búsqueda actuales.

Esta corrección previa a instalación modifica sólo services.sql,
services-access.sql y SERVICES_SETUP.md. services-moderation.sql se revisó sin
cambios. La tabla nueva es privada y el helper no está expuesto: no requiere
agregarla a Database.public ni cambiar tipos, funciones de acceso o DTO públicos.

## Consultas manuales de instalación (sólo lectura)

Ejecutar vos tras aplicar los tres archivos:

```sql
-- Deben aparecer diez tablas con RLS=true.
select n.nspname, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and (
  (n.nspname='public' and c.relname in (
    'service_providers','service_categories','service_listings',
    'service_listing_images','service_areas'))
  or (n.nspname='private' and c.relname in (
    'service_provider_locations','service_provider_contacts',
    'service_reports','service_audit_logs','service_category_search_terms')))
order by 1,2;

-- RPC nuevas y firmas exactas; todas públicas definer excepto ninguna expuesta helper.
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'save_my_service_provider','set_my_service_areas','save_my_service_listing',
 'manage_my_service_listing','set_my_service_listing_images',
 'set_my_service_provider_avatar','read_my_service_provider',
 'read_my_service_listings','read_public_service_provider',
 'read_public_service_listing','read_service_categories',
 'read_service_listings_page','read_service_providers_page','report_service',
 'admin_set_service_block','admin_resolve_service_report','admin_read_services')
order by p.proname;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='service-images';

select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where tablename in ('service_providers','service_listings',
 'service_listing_images','service_areas')
 or (schemaname='storage' and policyname like 'service_storage_%')
order by schemaname,tablename,policyname;

select public.read_service_categories(); -- 25 categorías.
select public.read_service_listings_page('Alta Gracia','AR-X','electricista');
select public.read_service_providers_page('Alta Gracia','AR-X','electricidad');

-- Cero grants de escritura a cliente sobre las nuevas tablas.
select table_schema,table_name,grantee,privilege_type
from information_schema.role_table_grants
where table_name in ('service_providers','service_categories','service_listings',
 'service_listing_images','service_areas','service_provider_contacts',
 'service_provider_locations','service_reports','service_audit_logs',
 'service_category_search_terms')
 and grantee in ('anon','authenticated')
order by table_name,grantee,privilege_type;
```

Leer como postgres no demuestra RLS. Comprobar acceso público con:

```sql
begin;
set local role anon;
select public.read_service_categories();
select public.read_service_listings_page('Alta Gracia','AR-X','');
select public.read_public_service_listing('52000000-0000-4000-8000-000000000001');
rollback;
```

La última consulta devuelve NULL si ese UUID no existe. Una búsqueda con localidad
vacía o provincia inválida debe devolver SERVICE_LOCATION_INVALID, nunca catálogo
nacional. Ejecutar esas consultas inválidas fuera de la transacción anterior.

### Consultas manuales de las correcciones

Como postgres, verificar las relaciones curadas y su normalización, sin crear
publicaciones ni ejecutar escrituras:

```sql
select c.slug, t.term, t.term_normalized, t.active
from private.service_category_search_terms t
join public.service_categories c on c.id=t.category_id
order by c.slug,t.term_normalized;

-- Cada expresión debe incluir la categoría esperada en matched_slugs.
-- También comprueba nombres de categoría/grupo y descarta combinaciones inventadas.
with examples(query,expected_slug) as (values
 ('electricista','electricidad'),
 ('cortar pasto','corte-pasto'),
 ('plomero','plomeria'),
 ('albañil','albanileria'),
 ('arreglar lavarropas','electrodomesticos'),
 ('profe particular','clases-particulares'),
 ('ELECTRICISTA','electricidad'),
 ('ALBANIL','albanileria'),
 ('electricidad','electricidad'),
 ('Reparaciones','electrodomesticos'),
 ('cortar lavarropas',null),
 ('arreglar',null)
)
select e.query,e.expected_slug,
 array(select c.slug from public.service_categories c
       where c.id=any(private.service_search_category_ids(e.query))
       order by c.slug) as matched_slugs
from examples e;

-- Con servicios QA publicados y cobertura Alta Gracia: comprobar ambas RPC.
-- Sin datos elegibles, total=0 es normal aunque la relación de categorías exista.
select q.query,
 public.read_service_listings_page('Alta Gracia','AR-X',q.query)->'total' as services,
 public.read_service_providers_page('Alta Gracia','AR-X',q.query)->'total' as providers
from (values ('electricista'),('cortar pasto'),('plomero'),('albañil'),
 ('arreglar lavarropas'),('profe particular')) q(query);

-- Ejemplo de filtro incompatible: electricista no amplía a Plomería.
select public.read_service_listings_page(
 p_locality=>'Alta Gracia', p_province_code=>'AR-X', p_query=>'electricista',
 p_category_id=>'51000000-0000-4000-8000-000000000103');

-- Ver cupo e historia: los retirados no se suman al cupo de 20.
select provider_id,
 count(*) filter(where status<>'WITHDRAWN') as used_slots,
 count(*) filter(where status='WITHDRAWN') as withdrawn,
 count(*) as historical_total
from public.service_listings
group by provider_id;
```

El filtro incompatible sólo dará cero si no hay un servicio de Plomería que
realmente mencione “electricista” en su título/descripción: el diccionario no
anula la búsqueda textual ni el filtro explícito. Para esa prueba usar títulos QA
neutros. La matriz privada verifica mapeo, no permisos de acceso público; los
escenarios con anon/otra cuenta y dos sesiones siguen siendo necesarios.

Revisión por lectura: RPC y tipos públicos conservan nombres, argumentos y DTO.
El tercer SQL continúa apuntando a las mismas tablas/helpers; no necesita cambio.
Policies de service-images y personal-listing-images tienen nombres distintos
y fronteras restrictivas limitadas a su bucket: para el otro bucket son TRUE.
No se detectó un conflicto nuevo por lectura; falta comprobar instalación y
comportamiento real porque no se ejecutó SQL ni validación automática.

## QA manual de RPC, con datos descartables

Sin pantallas aún: usar sesión QA vía cliente Supabase o SQL Editor con
BEGIN/SET LOCAL ROLE authenticated y
set_config('request.jwt.claim.sub','UUID_DE_USUARIO_QA',true).
Usar sólo UUID de una cuenta Auth/profiles QA existente y finalizar con ROLLBACK
si la prueba se realiza toda en SQL. No usar cuentas/productos reales ni inventar
credenciales. Storage se prueba por su API, no por inserts SQL.

1. Crear perfil [QA] con UUID generado una sola vez, referencia Anisacate,
   contact_method=WHATSAPP, número QA autorizado, contact_consent=true.
   Releer read_my_service_provider para conocer revisión.
2. set_my_service_areas con Alta Gracia y Anisacate; releer revisión.
   Una localidad duplicada con acentos/case distintos debe rechazarse.
3. Crear servicio [QA] con categoría Electricidad de read_service_categories,
   service_mode=ONSITE, pricing_mode=QUOTE, price=NULL. Releer propia revisión.
4. Publicar con manage_my_service_listing(action=publish). Fotos opcionales.
   Buscar Alta Gracia debe incluirlo; una localidad no declarada no.
5. Repetir edición con revisión vieja: SERVICE_CHANGED. Crear otro perfil de
   la misma cuenta debe devolver SERVICE_PROVIDER_EXISTS, no duplicarse.
6. Cuenta QA distinta: negar edición, cobertura, fotos y avatar ajenos; negar
   DML directo. Anon ve sólo el DTO público, sin owner_id/consent_at/admin.
7. Cambiar pricing_mode a FROM con precio positivo y guardar revisión actual;
   QUOTE con precio cero y FIXED sin precio deben rechazarse.
8. accepting_inquiries=false: servicio sigue publicado, WhatsApp del detalle
   desaparece. Pausar/retirar: no aparece en búsqueda ni detalle público.
9. Otra cuenta QA reporta servicio/prestador; repetir reporte abierto reutiliza
   ID. Admin lee reportes, bloquea con revisión/motivo y verifica auditoría;
   usuario no Admin no puede invocar esas acciones.
10. Bloquear prestador oculta todos sus servicios; desbloquear no republica
    pausados/retirados ni supera suspensión de cuenta. Restaurar estado QA.
11. Subir por API 1..5 fotos, registrar con revisión, reemplazar y limpiar.
    Archivo vinculado no puede borrarse; upsert no permitido; otro usuario no
    puede subir/borrar en carpeta ajena. Suspensión/bloqueo niega escrituras.
12. Simular resultado incierto: conservar UUID/ruta, releer, no crear otra entidad
    ni borrar fotos hasta confirmar referencias/revisión. Recuperar temporales.
13. Revisar TTL/firmas con visitante, retiro y bloqueo. Revisar paginación real
    cuando haya más de 24 servicios QA, sin duplicados por localidades.
14. Con títulos neutros, probar las seis expresiones de la tabla anterior en
    ambas RPC públicas. Repetir en mayúsculas/sin acentos, con filtros de categoría
    incompatibles, localidad no cubierta y publicaciones pausadas/bloqueadas.
    La expansión nunca debe saltarse esos filtros. Comparar total/páginas.
15. Con 19 servicios QA no retirados, lanzar dos creaciones con UUID distintos
    desde dos sesiones de la misma cuenta: una llega a 20 y la otra recibe
    SERVICE_LISTING_LIMIT. Retirar uno permite crear otro; editar el retirado
    debe fallar. Verificar que más de 100 retirados no impiden una nueva alta.

## Decisiones para la etapa visual

Valores adoptados, sin bloquear esta implementación: 20 servicios no retirados
sin tope histórico permanente, 30 localidades, cinco fotos, avatar opcional, fotos de
trabajos opcionales, cobertura compartida por prestador y tres modalidades.
Si querés otros límites o cobertura distinta por servicio, ajustar en delta
posterior antes del frontend. No se requieren nuevas claves ni dependencias.

Pendiente: probar manualmente el frontend y compilar cuando lo autorices.
Las pantallas y la integración al explorador general están implementadas; ver
SERVICES_SEARCH.md para el Prompt 7. No se acredita PASS de compilación ni QA de navegador.


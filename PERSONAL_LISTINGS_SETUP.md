# Publicaciones particulares — etapa 1, backend

Estado: el usuario confirmó que ejecutó los tres SQL en Supabase con **Success**.
Codex no ejecutó SQL remoto ni verificó el esquema remoto. El frontend funcional
del módulo está implementado; ver `PERSONAL_LISTINGS_FRONTEND.md`.
Todavía no hay integración al explorador comercial ni Realtime nuevo.

## Antes de ejecutar

El esquema remoto puede diferir del repositorio. Revisar estos prerrequisitos en
el SQL Editor antes de aplicar los deltas. Son consultas de lectura, no ejecutadas por Codex:

```sql
select
  to_regclass('public.profiles') as profiles,
  to_regclass('public.categories') as categories,
  to_regclass('private.user_suspensions') as suspensions,
  to_regclass('storage.objects') as objects,
  to_regprocedure('private.normalize_search_query(text)') as normalize_query,
  to_regprocedure('private.argentina_province_name(text)') as province_name,
  to_regprocedure('private.require_active_marketplace_user()') as active_account_guard,
  to_regprocedure('private.require_admin()') as admin_guard,
  to_regprocedure('public.is_my_account_suspended()') as suspension_check;

select table_schema, table_name, column_name, data_type
from information_schema.columns
where (table_schema='public' and table_name in ('profiles','categories'))
   or (table_schema='private' and table_name in ('user_suspensions','admin_users'))
   or (table_schema='storage' and table_name in ('buckets','objects'))
order by table_schema,table_name,ordinal_position;

select n.nspname as schema, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer, p.provolatile, p.proconfig
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.proname in
  ('normalize_search_query','argentina_province_name','require_active_marketplace_user','require_admin','is_my_account_suspended');
```

Todos los objetos de la primera consulta deben existir. Revisar las definiciones
de los helpers si sus firmas/contratos difieren: normalización de acentos,
provincia AR por código, rechazo de suspendidos y autorización Admin.
No ejecutar migraciones históricas otra vez ni asumir que faltan.

## Orden exacto de ejecución manual

Como `postgres` en Supabase SQL Editor, ejecutar cada archivo completo:

1. `supabase/personal-listings.sql`.
2. `supabase/personal-listings-access.sql`.
3. `supabase/community-moderation.sql`.

Son deltas de instalación única. Si un archivo falla, su transacción revierte:
no continuar al siguiente hasta resolver el error concreto. No volver a ejecutar
un archivo que ya terminó correctamente; futuras modificaciones usarán otro delta.

El primer archivo verifica dependencias y deja las tablas cerradas. El segundo
crea accesos y bucket; si encuentra un bucket del mismo nombre con configuración
diferente, falla sin convertirlo. El tercero completa reportes/moderación.
Las funciones públicas se notifican a PostgREST al finalizar.

No requiere nuevas variables de entorno, secret key, paquetes ni proveedores.
Se utilizan los clientes Supabase existentes con la sesión del solicitante.

## Tablas y relaciones

| Tabla | Relación / uso |
| --- | --- |
| `public.personal_listings` | `owner_id -> profiles.id`, `category_id -> categories.id`. Artículo y contacto autorizado. |
| `public.personal_listing_images` | `listing_id -> personal_listings.id`. Hasta cinco posiciones únicas, 0..4; posición 0 principal. |
| `private.personal_listing_locations` | Una por anuncio. Localidad, provincia canónica y país AR. GPS opcional reservado. |
| `private.personal_listing_reports` | Anuncio + denunciante autenticado. Un reporte abierto por persona/anuncio. |
| `private.personal_listing_audit_logs` | Admin + anuncio + reporte opcional. Bloqueos y resolución de reportes. |

No hay `business_id`, inventario, carrito ni reservas. No se alteran Auth,
perfiles, categorías existentes, comercios, productos, búsquedas o Realtime.

Título 1..160 caracteres; descripción hasta 5000; nombre público elegido hasta
120; precio ARS 0..9.999.999.999,99 con máximo dos decimales. Categoría debe existir.
Localidad 1..120, sin controles; provincia derivada en DB del código AR existente.
La localidad utiliza el mismo contrato textual normalizado del sistema actual;
esto no certifica geográficamente una localidad ni verifica al vendedor.

## Ciclo de publicación

- Crear siempre `DRAFT`, con localidad válida y sin necesidad de GPS/contacto/fotos todavía.
- `DRAFT -> PUBLISHED | WITHDRAWN`.
- `PUBLISHED -> PAUSED | SOLD | WITHDRAWN`.
- `PAUSED -> PUBLISHED | SOLD | WITHDRAWN`.
- `SOLD` y `WITHDRAWN` son terminales. No se reactivan ni editan sus datos;
  se pueden retirar sus referencias de imágenes para limpiar archivos.
- Publicar requiere 1..5 fotografías registradas y existentes, principal en
  posición cero, localidad y WhatsApp autorizado.
- Un vencimiento pasado oculta el anuncio, sin añadir un estado `EXPIRED` ni
  necesitar cron. Se puede renovar/quitar explícitamente el vencimiento mediante edición.
- Cambiar contenido/imágenes/estado incrementa `revision`; edición requiere
  la revisión leída. Ante conflicto, recargar y no sobrescribir automáticamente.

Los triggers diferidos verifican los requisitos finales de publicaciones
PUBLISHED sin bloqueo después de reemplazar imágenes dentro de una misma transacción.
Para quitar la última foto o revocar el contacto de una publicación activa,
pausarla primero. Un bloqueo administrativo no cambia el estado del propietario.

## Contacto y privacidad

`NONE` no tiene teléfono ni fecha de autorización. `WHATSAPP` exige número
argentino normalizado y `contact_consent=true`; la fecha la establece PostgreSQL.
Cambiar el número requiere una nueva autorización. No se copian email, teléfono
del perfil ni metadata de Google/Auth. El nombre público se elige expresamente.

La lectura pública devuelve sólo el contrato de presentación: artículo,
categoría, localidad, contacto consentido, fechas e imágenes. No devuelve owner_id,
GPS, domicilio, revisión, datos del perfil ni campos administrativos.

La tabla privada prepara latitude/longitude nullable, pero **ningún RPC de esta
etapa los recibe, guarda o devuelve**. Tampoco hay captura GPS, geocoding nuevo,
distancias, radios ni centroides. Coordenadas presentes en un JSON se rechazan.

## RLS y permisos

- Visitantes no tienen SELECT directo de tablas base: utilizan RPC públicos.
- Authenticated tiene SELECT propio de anuncios/imágenes mediante RLS, incluso
  para consultar su estado si la cuenta fue suspendida.
- Nadie del cliente tiene INSERT/UPDATE/DELETE directo en las tablas nuevas.
  Crear/editar/cambiar estados/fotos se realiza por RPC autorizados.
- Ubicaciones, reportes y auditoría privados no tienen grants directos.
- RPC SECURITY DEFINER tienen `search_path=''`, objetos calificados y grants
  mínimos; las lecturas propias verifican auth.uid y los cambios verifican
  cuenta activa, propiedad, estado, bloqueo y revisión cuando corresponde.
- Triggers adicionales defienden propietario inmutable, estados y requisitos
  de publicación. No se confía en owner_id/status enviados desde cliente.
- Ninguna lectura pública devuelve DRAFT, PAUSED, SOLD, WITHDRAWN, vencidos,
  bloqueados o anuncios de usuarios suspendidos, aunque se conozca el UUID.

## Decisión de Storage

Bucket **privado** `personal-listing-images`, JPEG/WebP, máximo 2 MiB por foto.
Rutas versionadas `listing-uuid/image-uuid.webp` o `.jpg`, sin ID del usuario ni
nombre de archivo original. UPDATE/upsert/move sobre este bucket no están permitidos;
se suben versiones nuevas.

Se descarta un bucket público: conocer una URL permanente permitiría leer fotos
de borradores/retirados aunque las filas ya no fueran visibles. Supabase permite
acceder a archivos privados mediante URLs firmadas limitadas en el tiempo.
Referencias: [modelos de bucket](https://supabase.com/docs/guides/storage/buckets/fundamentals)
y [políticas de acceso](https://supabase.com/docs/guides/storage/security/access-control).

Los visitantes pueden firmar exclusivamente objetos registrados de anuncios
actualmente públicos. El dueño puede leer/firmar sus fotos privadas para editarlas.
El cliente existente firma hasta 250 rutas en un lote (50 anuncios x 5 fotos),
con vigencia de **600 segundos**. No hace falta servicio privilegiado ni
transformación de imágenes paga. No persistir URLs firmadas; renovar cuando venzan.

Una URL ya firmada puede continuar accesible hasta su vencimiento después de
pausar/bloquear/suspender. No se promete revocación instantánea ni borrar copias
descargadas. Las nuevas firmas se deniegan al dejar de ser público.

Las policies restrictivas delimitan exclusivamente este bucket, incluso si
otra policy remota fuera permisiva. Fuera de él no cambian permisos existentes.
Escrituras verifican cuenta activa, propietario y ausencia de bloqueo administrativo.
La lectura pública y la lectura propia no bloquean a un lector por estar suspendido.

Se reutiliza `compressPhoto`: reencodificación JPEG/WebP y objetivo aproximado
350 KiB, sin conservar metadata original en el flujo normal. La compresión del
cliente no es una barrera contra subidas manuales; bucket/policies validan
tipo declarado, tamaño y acceso. No admite HTML/SVG. No hay pipeline nuevo
de inspección/antivirus ni garantías sobre contenido malicioso o metadata de
archivos subidos fuera de esa utilidad.

Máximo cinco relaciones activas. Se permiten hasta diez archivos por carpeta
(cinco activos + cinco versiones temporales), para reemplazos sin romper fotos
publicadas y para limitar huérfanos. Las fotos consumen las cuotas de Storage y
transferencia del proyecto; no hay cron ni limpieza automática de todo el bucket.

### Flujo de imágenes y eliminación

1. Crear borrador y conservar su UUID.
2. Comprimir/subir versiones con `uploadPersonalListingPhoto`.
3. Registrar/reordenar el conjunto con `savePersonalListingImages`; primera=principal.
4. La RPC comprueba existencia en Storage, propiedad y revisión, y reemplaza
   relaciones dentro de una transacción.
5. Limpiar los bytes desreferenciados por Storage API. Nunca DELETE SQL sobre
   `storage.objects`, que no elimina correctamente el archivo subyacente.

Registro y eliminación comparten bloqueo de anuncio: no se puede borrar un
objeto vinculado, incluso con una carrera. Ante deadlock/conflicto, recargar
antes de reintentar. Tras respuesta perdida se reconsulta antes de compensar;
si sigue incierto no se eliminan versiones nuevas. `pendingCleanup` permite
reintentar limpiezas; `PersonalListingUploadError.objectPath` conserva la ruta
de una subida incierta. No repetir una creación con un UUID nuevo sin reconciliar.

## Moderación

Se reutiliza la autorización Admin y la suspensión existentes. No se modifica
su RPC, UI, reportes, auditoría ni constraints comerciales. Este módulo utiliza
reportes/auditoría privados propios; **no aparecerán aún en el panel Admin actual**.
La futura interfaz deberá consultar los RPC nuevos.

Bloqueo/desbloqueo y resolución de reporte se auditan en la misma transacción.
El dueño no puede quitar el bloqueo ni editar/subir/eliminar contenido bloqueado.
Un desbloqueo conserva estado y vencimiento; un propietario suspendido sigue
sin poder editar y su anuncio sigue oculto públicamente.

Reportes requieren cuenta activa y anuncio público ajeno. Un reporte abierto
repetido devuelve el mismo ID. Límite propio de 10 reportes nuevos/24h, serializado;
no modifica los límites comerciales. Resolver un reporte no bloquea automáticamente
el anuncio: son acciones administrativas explícitas independientes.

## RPC y acceso TypeScript

| RPC | Acceso / función |
| --- | --- |
| `save_my_personal_listing` | Authenticated; alta DRAFT o edición propia con revisión. |
| `manage_my_personal_listing` | Authenticated; publish/pause/sold/withdraw. |
| `set_my_personal_listing_images` | Authenticated; conjunto ordenado 0..5, 1..5 si PUBLISHED. |
| `read_my_personal_listings` | Dueño; detalle/listado paginado, estado/categoría/localidad/texto/fecha de creación. |
| `read_public_personal_listing` | Visitantes; detalle público o null, también para enlaces compartidos. |
| `read_personal_listings_page` | Visitantes; localidad+provincia obligatorias, categoría, NEW/USED, texto y fecha de publicación. |
| `report_personal_listing` | Authenticated activo; reporte público ajeno. |
| `admin_set_personal_listing_block` | Admin; bloqueo/desbloqueo auditado. |
| `admin_resolve_personal_listing_report` | Admin; resolver/descartar con auditoría. |
| `admin_read_personal_listings` | Admin; listings/reports/audit paginados. |

Búsqueda GIN con `simple`, normalización compartida de acentos/mayúsculas y
prefijos de palabras: `bici` encuentra `bicicleta`; términos múltiples deben
coincidir. No es un substring arbitrario dentro de cualquier palabra. Sin
extensiones nuevas. Filtros de fecha: desde inclusivo, hasta exclusivo.
Paginación por offset/limit en PostgreSQL (1..50, default 24), total del mismo
snapshot y desempate por UUID. Publicaciones sólo PUBLISHED; otros estados se
filtran únicamente en consultas del dueño/Admin. No se mezcla con analytics actual.

`src/lib/personal-listings/client.ts` funciona con el cliente Supabase existente;
`server.ts` usa sesión SSR sin secretos; `admin.ts` es server-only.
`contracts.ts` valida JSON y construye DTO explícitos, sin casts a modelos completos
ni traslado de campos privados inesperados. `images.ts` prepara/sube/registra/
limpia/firma fotos. Errores técnicos se traducen a mensajes controlados.

## Verificaciones manuales posteriores al SQL

Estas consultas no fueron ejecutadas. Las siguientes son de lectura:

```sql
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies
where tablename in ('personal_listings','personal_listing_images','personal_listing_locations',
  'personal_listing_reports','personal_listing_audit_logs')
  or (schemaname='storage' and policyname like 'personal_listing_storage_%')
order by schemaname,tablename,policyname;

select n.nspname,c.relname,c.relrowsecurity from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where c.relname in ('personal_listings','personal_listing_images','personal_listing_locations',
  'personal_listing_reports','personal_listing_audit_logs');

select
  has_table_privilege('anon','public.personal_listings','SELECT') as anon_direct_read,
  has_table_privilege('authenticated','public.personal_listings','INSERT') as client_insert,
  has_table_privilege('authenticated','public.personal_listings','UPDATE') as client_update,
  has_table_privilege('authenticated','public.personal_listings','DELETE') as client_delete,
  has_table_privilege('authenticated','private.personal_listing_locations','SELECT') as private_location_read;
-- Todos FALSE. SELECT authenticated de anuncios/imágenes sí existe, limitado por RLS.

select id,public,file_size_limit,allowed_mime_types from storage.buckets
where id='personal-listing-images';
-- public=false; 2097152 bytes; JPEG/WebP.

select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
  'save_my_personal_listing','manage_my_personal_listing','set_my_personal_listing_images',
  'read_my_personal_listings','read_public_personal_listing','read_personal_listings_page',
  'report_personal_listing','admin_set_personal_listing_block',
  'admin_resolve_personal_listing_report','admin_read_personal_listings'
) order by p.proname;
-- Sólo read_public_personal_listing/read_personal_listings_page permiten anon.

select indexname,indexdef from pg_indexes
where tablename in ('personal_listings','personal_listing_locations','personal_listing_images');

select conname,pg_get_constraintdef(oid) from pg_constraint
where conrelid in ('public.personal_listings'::regclass,'public.personal_listing_images'::regclass,
  'private.personal_listing_locations'::regclass);
```

Comprobar un resultado público sin hacerse pasar por vendedor:

```sql
begin;
set local role anon;
select public.read_personal_listings_page('Alta Gracia','AR-X',p_query=>'CAFE');
with page as (
  select public.read_personal_listings_page('Alta Gracia','AR-X') as document
)
select item->>'id' as listing_id,
  item ?| array['owner_id','latitude','longitude','address','contact_consent_at','admin_blocked_by'] as leaks_private_fields
from page cross join lateral jsonb_array_elements(document->'items') item;
-- leaks_private_fields debe ser FALSE en cada fila; inicialmente puede no haber anuncios.
rollback;
```

Para comprobar lectura propia, sustituir el UUID por una cuenta QA real; esto
simula contexto únicamente en el SQL Editor de confianza, no sustituye una prueba
posterior con JWT real desde el SDK:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_DE_CUENTA_QA","role":"authenticated"}', true);
select public.read_my_personal_listings();
rollback;
```

Con dos cuentas QA y Admin, verificar manualmente por SDK/SQL Editor controlado:

| Caso | Esperado |
| --- | --- |
| Borrador propio, sin GPS ni fotos | Creación y lectura propia; no aparece públicamente. |
| Publicar sin fotos/contacto | `PERSONAL_LISTING_PUBLISH_REQUIREMENTS`; transacción revertida. |
| Una foto válida, localidad y consentimiento | Publica; búsqueda por localidad y café/CAFE/cafe coincide. |
| Editar/listar borrador ajeno | Rechazo/ausencia; sin datos del propietario. |
| JSON con owner_id/status/GPS | `PERSONAL_LISTING_INVALID_INPUT`. |
| Sexta foto o ruta de otro anuncio | Rechazo; conserva conjunto anterior. |
| Borrar bytes todavía vinculados | Denegado por policy; fotos permanecen. |
| Dos ediciones con misma revisión | Una aplica; la otra exige recargar. |
| Pausar/vender/retirar/vencer | No aparece ni permite nuevas firmas públicas. |
| Admin bloquea | Oculto; el dueño no puede reactivar ni editar. |
| Admin desbloquea SOLD/PAUSED | Conserva el estado previo; no publica automáticamente. |
| Cuenta suspendida | Rechazo de cambios/subidas; anuncios ocultos; lectura propia permitida. |
| No Admin llama RPC administrativo | Rechazo, sin modificaciones ni auditoría falsa. |
| Reportar anuncio ajeno / resolver | Reporte privado, resolución y auditoría atómicas. |

Usar sólo datos `[QA]`; no insertar filas ficticias en `storage.objects` para
simular fotos: los archivos deben subirse mediante Storage API. No borrar datos
comerciales. La implementación de pantallas continuó después de la confirmación
del usuario de que los tres SQL se ejecutaron correctamente. Estas verificaciones
manuales siguen pendientes de ejecución por el usuario.

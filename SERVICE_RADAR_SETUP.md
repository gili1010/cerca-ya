# CercaYa 2.0 — Radar de servicios, backend (Prompt 8, etapa 1)

## Estado y alcance

El usuario confirmó instalados y verificados los tres SQL de Radar de servicios.
La comprobación incluyó cinco tablas con RLS, once RPC autenticadas sin acceso
anónimo ni directo y ausencia de nuevas tablas en Realtime. No es necesario
volver a ejecutarlos. La instalación fue realizada por el usuario, no por Codex.
El frontend del Prompt 9 se documenta en SERVICE_RADAR_FRONTEND.md.
No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, despliegues
ni instalaciones. No se declara PASS de compilación, SQL o concurrencia real.

Los tres SQL de servicios previos ya están instalados según la confirmación del
usuario. Este módulo no los cambia. Tampoco modifica tablas/RPC comerciales,
particulares, Auth, Storage, RLS existentes ni Realtime. No agrega pantallas.

Aceptar una propuesta significa **elegir un prestador**, no contratar, agendar,
confirmar que trabajó o registrar un pago. No se crean reservas ni se toca stock.

## Auditoría y patrones reutilizados

- `supabase/request-location-radar.sql`: creación con UUID del caller, Radar por
  RPC y revalidación al enviar oferta. Su radio/Haversine es comercial y NO se
  reutiliza para servicios. No se amplía `requests` ni `offers`.
- `supabase/realtime.sql`: aviso mínimo seguido de reconsulta autorizada. Se
  conserva como patrón para una etapa futura; no se toca `realtime.messages`,
  la publicación ni los triggers existentes.
- `supabase/admin-phase-2.sql`: se reutilizan `private.require_active_marketplace_user`
  (Auth, bloqueo compartido de auth.users y suspensión) y `private.require_admin`.
- `supabase/services.sql`, `services-access.sql`, `services-moderation.sql`:
  categorías propias, cobertura `service_areas`, revisiones, bloqueo parental del
  prestador, DTO reconstruido, SECURITY DEFINER/search_path vacío, reportes y
  auditoría propios. Se reutilizan los helpers de elegibilidad pública, validación
  de localidad/JSON y DTO autorizado del perfil; no se copian contactos privados.
- `src/lib/services/{client,server,contracts,admin}.ts`: paginación validada, errores
  amigables, cookies SSR sin claves privilegiadas y administración server-only.
  Sus interfaces quedan intactas.

## Instalación: orden exacto

Referencia para un entorno nuevo. El proyecto actual ya fue instalado y verificado;
no volver a ejecutar estas migraciones por la etapa de frontend.

Ejecutar manualmente en Supabase SQL Editor, como postgres, **una sola vez**:

1. `supabase/service-radar.sql`
2. `supabase/service-radar-access.sql`
3. `supabase/service-radar-moderation.sql`

Esperar Success de cada transacción antes de continuar. No reejecutar los SQL de
servicios ya instalados. No hay cambios de buckets, claves o variables de entorno.
Los archivos nuevos usan CREATE, no pretenden ser reejecutables sobre una
instalación ya realizada. Conservar los mensajes reales si algún paso falla.

Prerrequisitos: profiles, service_providers, service_listings (UNIQUE id/provider_id),
service_categories, service_areas, private.user_suspensions y los helpers existentes
de autenticación, Admin, normalización, provincias, validación y DTO de servicios.

## Modelo y relaciones

| Tabla | Relación y finalidad |
| --- | --- |
| `public.service_requests` | requester_id → profiles; category_id → especialidad real; localidad/provincia; texto; fechas; estado y revisión; bloqueo. |
| `public.service_request_offers` | request_id → solicitud; provider_id → prestador; FK compuesta servicio/prestador; mensaje/presupuesto; estado y revisión; bloqueo. |
| `private.service_radar_reports` | Denuncias exclusivamente de solicitudes/propuestas de este dominio, actor, resolución y revisión. |
| `private.service_radar_audit_logs` | Acciones Admin, actor, entidad, denuncia, razón/nota y fecha. |
| `private.service_radar_write_limits` | Una fila por usuario, ventana de un minuto y contador; no una historia ilimitada de actividad. |

UUID de solicitudes y propuestas lo genera y conserva el caller antes de escribir.
No hay business_id, coordenadas, calle, número de vivienda ni contacto del comprador.
País AR. Provincia validada contra el catálogo existente; localidad 1–120 caracteres
normalizada en PostgreSQL. Título 8–120, descripción 20–2000 y mensaje 10–1500.
Presupuestos FIXED/FROM positivos, hasta dos decimales y 9.999.999.999,99 ARS;
QUOTE exige NULL, nunca cero. No se copia el precio del servicio al editar una oferta.

`selected_offer_id` usa FK compuesta para asegurar que pertenece a esa solicitud.
UNIQUE(request_id,provider_id) admite una sola propuesta histórica por profesional
y solicitud; retirar/rechazar no abre otro cupo para inundar la misma necesidad.
Un índice parcial permite una sola ACCEPTED por solicitud. Triggers diferidos
comprueban al final de la transacción que selección, aceptación y cierre coincidan.

## Estados y decisiones de producto

Solicitudes:

- Nacen OPEN y vencen a los siete días; el cliente no puede extender la fecha.
- OPEN → CLOSED por aceptar una propuesta, con selected_offer_id.
- OPEN → CLOSED también permite cerrar voluntariamente sin elegir (selected NULL).
- OPEN → CANCELLED por el solicitante antes del vencimiento.
- OPEN → EXPIRED puede materializarse por acción `expire` del solicitante después
  del plazo. No hace falta ejecutarla para aplicar el vencimiento.
- Los tres estados terminales no se reabren ni editan. Bloquear/desbloquear puede
  cambiar metadatos administrativos y revisión, sin cambiar el estado funcional.

Toda lectura de solicitudes transforma OPEN vencido en EXPIRED. Radar y mutaciones
comprueban fecha además del estado físico. Enviar/editar/aceptar/rechazar propuestas
exige solicitud abierta y vigente; se revisa el reloj después de esperar bloqueos.
La materialización EXPIRED rechaza pendientes. Sin materializar, las propuestas
pueden conservar PENDING histórico, pero la solicitud anidada muestra EXPIRED:
**PENDING no implica que se pueda aceptar**. No hay cron nuevo.

Edición de una solicitud: sólo abierta, vigente, no bloqueada y sin ninguna propuesta
histórica, para no cambiar las condiciones sobre las que alguien ya presupuestó.
Si tiene propuestas, puede cancelarse/cerrarse y crearse otra necesidad.

Propuestas:

- Nacen PENDING. Se puede editar mensaje/precio con revisión mientras siga pendiente,
  vigente y elegible. El servicio elegido no se cambia después del alta.
- PENDING → ACCEPTED sólo por el solicitante; cierra la necesidad y rechaza las otras
  pendientes en la misma transacción. No elimina ninguna propuesta.
- PENDING → REJECTED por el solicitante; no cierra la necesidad por sí sola.
- PENDING → WITHDRAWN por su prestador. Se permite retirar aun si perdió cobertura,
  habilitación o la solicitud quedó bloqueada; el actor debe seguir sin suspensión.
- Resueltas son terminales. Bloquear una ya aceptada oculta contacto/disponibilidad,
  sin reabrir la solicitud ni borrar la selección histórica.

## RPC y contratos

Todas las listas devuelven `{items,total,offset,limit}`, con orden created_at DESC,
id DESC. Offset >=0, limit 1–50 (24 por defecto); helper TS evita overflow de integer.
Filtros/deduplicación/paginación se ejecutan en PostgreSQL.

| RPC | Firma resumida / función |
| --- | --- |
| `save_my_service_request` | UUID, JSON `{title,description,category_id,city,province_code}`, expected_revision NULL para crear o número para editar. |
| `read_my_service_requests` | request_id opcional, offset, limit; también detalle propio filtrando UUID. |
| `read_service_radar` | request_id opcional para oportunidad, category_id exacto opcional, offset, limit; prestador inferido por Auth. |
| `save_my_service_request_offer` | offer_id, request_id, service_listing_id, JSON `{message,pricing_mode,proposed_price}`, expected_revision. |
| `read_service_request_offers` | seller=false: propuestas recibidas; seller=true: propias enviadas. request_id/offer_id opcionales, offset, limit. |
| `manage_my_service_request` | request_id, action cancel/close/expire, expected_revision. |
| `manage_my_service_request_offer` | offer_id, action accept/reject/withdraw, expected_revision de oferta; request_expected_revision obligatoria para accept/reject. |
| `report_service_radar` | entity request/offer, id, reason del catálogo, details opcional. |
| `admin_read_service_radar` | section requests/offers/reports/audit, request_id/offer_id/status opcionales válidos para la sección, offset, limit. |
| `admin_set_service_radar_block` | entity, id, blocked, expected_revision, reason obligatorio al bloquear, note opcional. |
| `admin_resolve_service_radar_report` | report_id, status RESOLVED/DISMISSED, expected_revision, note. |

Las mutaciones de usuario devuelven el UUID; las administrativas devuelven void.
El detalle ajeno no devuelve datos: las listas propias filtran por Auth. Las RPC
Admin vuelven a comprobar el permiso en PostgreSQL, incluso si se invocan directamente.

## Coincidencias y rendimiento

Se requiere especialidad hoja activa con grupo activo; no se aceptan grupos como
categoría de necesidad. **No hay expansión a categorías padre ni sinónimos en Radar**:
la búsqueda pública por oficios sigue siendo otro módulo. Debe coincidir exactamente
category_id de la necesidad con un servicio público PUBLISHED del profesional.
Además se exige accepting_inquiries=true, perfil activo/no bloqueado, contacto
autorizado y cuenta no suspendida, según los helpers existentes.

La provincia/localidad normalizadas deben existir en service_areas. La referencia
domiciliaria del profesional no decide nada. REMOTE también cumple esa cobertura.
Se excluyen necesidades propias, bloqueadas, vencidas o de solicitantes suspendidos.
La consulta parte de solicitudes y cruza conjuntos DISTINCT de especialidades
habilitadas y cobertura del prestador; las revalidaciones usan EXISTS. No parte
de cada servicio coincidente: tres servicios de electricidad producen una sola
oportunidad. Se precalculan sus categorías/cobertura, sin evaluar todos sus servicios
para cada solicitud ajena. No se revela cuántas
propuestas ajenas hay ni sus UUID. Sólo se incluye my_offer_id propio cuando exista.

Índices: Radar por especialidad/provincia/localidad/fecha, OPEN por vencimiento,
solicitante/fecha, estado/fecha, ofertas por solicitud/fecha y prestador/fecha, además
de índices de reportes/auditoría y restricciones únicas. Se reutilizan índices de
service_areas y servicios. No se añade FTS porque el Radar usa especialidad exacta.

## Atomicidad, conflictos y respuestas inciertas

Todas las escrituras de un actor toman su bloqueo advisory propio. Se serializan
conteos y dobles clics. Repetir una creación con el mismo UUID devuelve el registro
propio ya creado, incluso si después cambió de estado: es recuperación, no reedición
ni nueva publicación. Un UUID de otro propietario no se puede recuperar.

Una solicitud idéntica abierta con otro UUID se rechaza con
SERVICE_RADAR_DUPLICATE_REQUEST. Otra propuesta del mismo prestador con otro UUID
recibe SERVICE_RADAR_DUPLICATE_OFFER. Una respuesta incierta **no autoriza a generar
otro UUID ni a anunciar éxito**: conservar UUID e input, consultar detalle propio,
comparar campos/revisión/estado y decidir si se confirmó o corresponde reintentar.
`ServiceRadarMutationError` expone sólo recordId y uncertain, con mensaje amigable.

Edición/gestión exige revisión exacta; conflicto SERVICE_RADAR_CHANGED/40001 implica
recargar antes de reintentar. Una segunda aceptación debe fallar, no sobrescribir
la selección inicial. Para resolver una respuesta incierta de aceptar, reconsultar
la solicitud y verificar selected_offer_id + estado CLOSED + oferta ACCEPTED.

En envío/aceptación se bloquean cuentas participantes (compartido, compatible con
el bloqueo exclusivo de suspensión), solicitud y luego prestador/servicio/categorías.
La solicitud bloqueada serializa envío, edición, cancelación, moderación y selección.
El bloqueo del prestador coordina con la edición de perfil, cobertura y servicios
existente. Elegibilidad se vuelve a comprobar bajo esos bloqueos; no basta haber
visto una oportunidad unos segundos antes. Fechas se revisan con clock_timestamp
después de las esperas. El índice único y el constraint diferido son defensas extra.

## Límites iniciales

- Diez solicitudes OPEN no vencidas por usuario; veinte altas en las últimas 24 h.
- Cincuenta propuestas nuevas en 24 h por prestador y una histórica por solicitud.
- Treinta mutaciones confirmadas/minuto/usuario en este dominio, incluyendo edición,
  gestión y reportes. Una fila por usuario se reutiliza en cada ventana.
- Diez denuncias nuevas en 24 h; una abierta por actor/entidad. Repetir devuelve la
  denuncia abierta sin duplicarla. Razón de catálogo; details <=1000, nota <=500.

No hay límite histórico permanente de necesidades/propuestas. Las cuotas se
comprueban dentro de la transacción. Operaciones fallidas revierten su contador:
el límite DB no reemplaza protección de tráfico/abuso en infraestructura, pendiente
para una futura etapa si el uso lo exige.

## Privacidad, RLS y contacto

Las cinco tablas nuevas tienen RLS habilitada y privilegios revocados para PUBLIC,
anon y authenticated. **No se crean policies de acceso directo**: default-deny.
No son tablas de catálogo público. RPC públicas se revocan a PUBLIC/anon y se
conceden sólo a authenticated; cada RPC controla propietario/actor/elegibilidad
o Admin. Auxiliares private no son ejecutables por clientes. SECURITY DEFINER
utiliza search_path vacío y relaciones calificadas.

DTO de solicitud: texto, categoría, localidad/provincia, estado efectivo, fechas,
revisión y disponibilidad. requester_id, ciudad normalizada interna, motivos de
bloqueo, Auth, direcciones y coordenadas no se envían. selected_offer_id sólo se
rellena para el solicitante. El prestador recibe sólo my_offer_id propio.
DTO de oferta incluye el prestador público y el presupuesto, nunca datos del
comprador ni ofertas competidoras. El historial propio de un prestador conserva
el texto/localidad de la solicitud a la que ya respondió, aun si perdió elegibilidad;
no habilita nuevas acciones ni acceso a otras necesidades o propuestas.

Después de seleccionar, sólo el comprador recibe contact_whatsapp del profesional,
si la oferta/solicitud no está bloqueada, el servicio continúa público y acepta
consultas, y la cobertura y autorización siguen disponibles. Se reutiliza la
proyección pública del perfil. No se devuelve contacto del comprador. Un enlace al
perfil público siempre usa su id, no owner_id.

`available` en una oferta significa habilitación actual de su prestador/servicio y
ausencia de bloqueo; no sustituye status/revisión/fecha de la solicitud para aceptar.
Puede ser true en una oferta ya aceptada. Las RPC son la autoridad final.

**Texto libre:** no se inventa un detector que prometa quitar teléfonos/domicilios.
Un usuario podría escribirlos en su texto. La UI siguiente debe mostrar antes de
publicar `serviceRequestPrivacyNotice`: «No publiques teléfonos, emails ni domicilios
exactos…». La constante está preparada; no hay pantalla nueva en esta entrega.
Reportes permiten moderar contenido inapropiado. La privacidad estructural no es
una garantía de que todo texto introducido por un usuario carezca de datos personales.

## Moderación y futuras actualizaciones

Tablas de reportes/auditoría independientes: no se mezclan con denuncias comerciales,
particulares ni de publicaciones de servicios. Sólo puede reportar una solicitud
un prestador compatible o que ya haya respondido; sólo su comprador puede reportar
una propuesta recibida. No se admite autoreporte ni acceso a ofertas ajenas.

Admin puede consultar, bloquear/desbloquear con revisión y razón, resolver o
desestimar y leer auditoría. No puede elegir propuestas en nombre del solicitante.
Bloqueos no alteran estados ni borran historia; desbloquear no reabre ni vence plazos.
Los helpers administrativos son server-only y sólo loguean operación/código,
nunca texto, contactos, tokens ni cuerpos de RPC.

No se registra ninguna tabla en supabase_realtime ni se crean suscripciones o
triggers de difusión. Futuro: avisos mínimos en canales privados de comprador y
prestador, autorización de membresía, sin payload de texto/contactos ni IDs ajenos;
siempre reconsulta RPC segura. Para Radar preferir un aviso agregado/debounced o
refresh por foco antes de crear fan-out por solicitud o prestador.

## Archivos

Nuevos:
- `supabase/service-radar.sql`
- `supabase/service-radar-access.sql`
- `supabase/service-radar-moderation.sql`
- `src/types/service-radar.ts`
- `src/lib/service-radar/contracts.ts`
- `src/lib/service-radar/client.ts`
- `src/lib/service-radar/server.ts`
- `src/lib/service-radar/admin.ts`
- `SERVICE_RADAR_SETUP.md`

Modificado: `src/types/database.ts`, sólo tablas/RPC nuevas, conservando cambios previos.

## Verificación manual de instalación (no ejecutada por Codex)

Como postgres, consultas sólo de lectura después de instalar:

```sql
select n.nspname, c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname='public' and c.relname in ('service_requests','service_request_offers'))
   or (n.nspname='private' and c.relname in
       ('service_radar_reports','service_radar_audit_logs','service_radar_write_limits'));

select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef, p.proconfig,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in (
 'save_my_service_request','read_my_service_requests','read_service_radar',
 'save_my_service_request_offer','read_service_request_offers',
 'manage_my_service_request','manage_my_service_request_offer','report_service_radar',
 'admin_read_service_radar','admin_set_service_radar_block','admin_resolve_service_radar_report')
order by p.proname;

select n.nspname,p.proname,has_function_privilege('authenticated',p.oid,'EXECUTE') as can_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='private' and (p.proname like '%service_radar%' or p.proname='guard_service_radar_row');

select schemaname,tablename,indexname from pg_indexes
where tablename in ('service_requests','service_request_offers','service_radar_reports','service_radar_audit_logs');

select has_table_privilege('authenticated','public.service_requests','SELECT') as direct_read,
       has_table_privilege('authenticated','public.service_requests','INSERT') as direct_insert,
       has_table_privilege('authenticated','public.service_request_offers','SELECT') as direct_offer_read;

select schemaname,tablename from pg_publication_tables
where pubname='supabase_realtime' and tablename in ('service_requests','service_request_offers');
```

Esperar RLS=true, anon_execute=false y authenticated_execute=true para RPC públicas
(Admin además exige su permiso interno); auxiliares private=false; acceso directo
false; sin tablas nuevas en publicación Realtime. SQL Editor postgres no demuestra
aislamiento por sí solo: para las pruebas de permisos usar sesiones QA reales o
herramientas de impersonación autorizadas. No distribuir service-role/secret keys.

## Recorrido manual con cuentas QA (sin pantallas nuevas)

Usar cliente Supabase autenticado existente y RPC/funciones cliente; sustituir UUIDs
de ejemplo por IDs QA propios. Ninguna de estas instrucciones fue ejecutada aquí.

```ts
// Como comprador QA. Conservar este UUID antes de enviar, incluso si la red falla.
const requestId = crypto.randomUUID();
await supabase.rpc('save_my_service_request', {
 p_request_id: requestId,
 p_input: { title: '[QA] Necesito un electricista', description: 'Necesito revisar un tablero eléctrico. Solicitud descartable de QA.',
   category_id: '<UUID de la especialidad Electricidad>', city: 'Alta Gracia', province_code: 'AR-X' },
 p_expected_revision: null,
});
await supabase.rpc('read_my_service_requests', { p_request_id: requestId });

// Otra cuenta QA: profesional con servicio publicado de Electricidad y cobertura.
await supabase.rpc('read_service_radar', { p_request_id: requestId, p_offset: 0, p_limit: 24 });
const offerId = crypto.randomUUID();
await supabase.rpc('save_my_service_request_offer', {
 p_offer_id: offerId, p_request_id: requestId, p_service_listing_id: '<UUID del servicio QA>',
 p_input: { message: '[QA] Podemos revisar el tablero y coordinar el alcance.', pricing_mode: 'QUOTE', proposed_price: null },
 p_expected_revision: null,
});
await supabase.rpc('read_service_request_offers', { p_seller: true, p_offer_id: offerId });

// Comprador QA: leer revisiones actuales ANTES de aceptar.
await supabase.rpc('read_service_request_offers', { p_request_id: requestId });
await supabase.rpc('manage_my_service_request_offer', {
 p_offer_id: offerId, p_action: 'accept', p_expected_revision: 1, p_request_expected_revision: 1,
}); // Cambiar ambos 1 por las revisiones realmente leídas.
await supabase.rpc('read_my_service_requests', { p_request_id: requestId });
```

Verificar manualmente antes de conectar UI:

1. Anónimo rechazado; cuenta suspendida rechazada; comprador ajeno no lee ni edita;
   prestador no lee propuestas de competidores ni necesidades incompatibles por UUID.
2. Referencia Anisacate/cobertura Alta Gracia coincide en Alta Gracia; localidad no
   cubierta no coincide. REMOTE igual. Otro oficio o categoría padre no habilitan.
3. Varios servicios de igual especialidad producen una oportunidad. Sin aceptar
   consultas, servicio pausado/retirado/bloqueado, grupo deshabilitado o perfil
   inactivo/bloqueado/suspendido no permiten Radar, envío ni aceptación.
4. Repetir alta con mismo UUID no duplica; con distinto UUID e igual necesidad se
   rechaza; propuesta repetida por prestador/solicitud no duplica. Recuperar respuestas
   inciertas por detalle propio; no considerar el error como prueba de que no se guardó.
5. Editar con revisión vieja falla; editar necesidad con propuestas falla. QUOTE con
   cero/precio no nulo falla; FIXED/FROM nulos/cero/negativos o más de dos decimales fallan.
6. En dos sesiones concurrentes del comprador, aceptar propuestas distintas: sólo
   una queda ACCEPTED y selected_offer_id coincide; las otras quedan REJECTED.
   Cerrar/cancelar concurrentemente tampoco permite aceptación posterior.
7. Perder cobertura, consentimiento o habilitación entre consultar y enviar/aceptar
   debe denegar. Suspensión/moderación concurrente debe serializarse sin aceptar
   contra el estado ya bloqueado; ensayar ambos órdenes de commit en entorno QA.
8. Necesidad vencida se ve EXPIRED aunque siga OPEN físico y no admite propuestas
   ni aceptación. Para ensayar sin esperar siete días, un administrador puede preparar
   un fixture vencido en entorno aislado; no alterar pedidos reales ni producción.
9. Antes de selección, el DTO no entrega contacto del comprador ni el WhatsApp del
   profesional por este flujo. Después entrega sólo WhatsApp público autorizado
   al comprador; revocar autorización/bloquear vuelve a ocultarlo en la reconsulta.
10. Verificar cancel/close/expire rechazan pendientes; withdraw terminal no puede
    aceptarse ni recrearse; rechazar permite seguir comparando las restantes.
11. Reporte duplicado abierto se reutiliza; no autoreportes; no reporte de ofertas
    ajenas. Admin lista, bloquea, desbloquea, resuelve y deja auditoría; no Admin falla.
12. Probar cuotas y solicitudes simultáneas próximas al límite con usuarios QA,
    paginación estable, totales y recuperación después de caída de conexión.

## Pendientes de la próxima etapa

La instalación y su verificación fueron confirmadas por el usuario. La validación
manual del circuito frontend y compilación siguen pendientes.
La etapa backend no agregó UI. El frontend posterior está en SERVICE_RADAR_FRONTEND.md.
No hay notificaciones, almacenamiento offline de operaciones, mensajería,
calendario, contratación, pagos ni ejecución automática del trabajo. El frontend
debe persistir UUIDs de borradores y reconsultar tras cada mutación/reconexión.
Futuro trabajo: UX de comparación/contacto, revisar cuotas con uso real y, sólo si
se necesita, limpieza materializada de vencidos/retención y protección de tráfico.
No se implementan en esta etapa ni se requiere cron para bloquear vencimientos.

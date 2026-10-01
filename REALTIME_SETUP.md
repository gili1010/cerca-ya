# Realtime de pedidos, Radar y ofertas

## Instalación manual

Sí: ejecutá **sólo `supabase/realtime.sql` completo** en tu proyecto Supabase → SQL Editor → New query. Se aplica sobre la instalación que ya tiene pedidos, Radar y ofertas funcionando. No repetir `schema.sql`, `seed.sql`, `request-rls.sql` ni `radar-offer-rls.sql`.

Si la versión anterior dio `42501: must be owner of table messages`, copiá nuevamente el archivo corregido en una consulta nueva y ejecutalo completo con el rol `postgres` del SQL Editor. Se eliminó la instrucción `ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY`: Supabase ya habilita RLS en esa tabla administrada y permite gestionar sus policies, pero no ese ALTER TABLE. No cambies el propietario ni desactives RLS. El error aborta la transacción de la versión anterior, por lo que no alcanza con ejecutar sólo las líneas posteriores al error. Ver [autorización de Realtime](https://supabase.com/docs/guides/realtime/authorization).

No se consultó la configuración remota ni se ejecutó SQL desde esta tarea. El archivo consulta `pg_publication_tables` al ejecutarlo vos, crea `supabase_realtime` si falta y agrega `public.requests` y `public.offers` sólo cuando aún no están incluidas. Al final muestra ambas tablas como resultado informativo. No agrega otras tablas de negocio ni quita tablas que alguien hubiera habilitado anteriormente.

Además de la publicación, el archivo instala dos triggers AFTER INSERT/UPDATE/DELETE y la autorización para sus avisos privados. Son necesarios para este frontend: marcar solamente las tablas en el Dashboard no instala los avisos del Radar. Las funciones se reemplazan y los triggers/policies propios se recrean con el mismo nombre, por lo que se puede reaplicar razonablemente sin duplicarlos.

No cambia `schema.sql`, las políticas ni permisos de `requests`/`offers`, ni usa REPLICA IDENTITY FULL. No modifica productos, stock, comercios, perfiles, categorías ni reservas. Las consultas auxiliares de propietarios sólo autorizan la recepción; no habilitan Realtime para esas tablas.

## Por qué se usa Broadcast privado

El comercio no tiene SELECT sobre las filas completas de requests. Ampliar ese permiso para recibir Postgres Changes expondría columnas privadas del comprador. Se conserva `read_radar` como proyección autorizada y se usa **Supabase Realtime Broadcast privado desde triggers** para avisar que hay cambios. La publicación de requests/offers queda habilitada, pero el frontend de esta etapa escucha los Broadcast y no las filas crudas de Postgres Changes.

Los mensajes del Radar sólo contienen `{ entity: 'radar', operation: 'REFRESH' }`. No contienen IDs de ofertas ajenas, título, buyer_id, dirección ni coordenadas. Cada comercio activo con dueño recibe ese aviso en su propio canal; luego vuelve a consultar `read_radar`, que exige comercio propio activo y devuelve exclusivamente pedidos OPEN vigentes. No se amplía el acceso a pedidos cerrados/cancelados.

Los canales del comprador/vendedor envían únicamente UUID del recurso, UUID del pedido, operación y estado. Nunca se emite NEW/OLD completo. La información comercial de la oferta sigue llegando mediante `read_offers`, con sus controles de propietario.

La recepción requiere una policy de SELECT sobre `realtime.messages` que verifica auth.uid() y la propiedad del recurso. También se agrega una policy restrictiva para que una policy permisiva anterior no abra los namespaces de CercaYa. Otra policy restrictiva impide que clientes publiquen avisos en esos canales. Las funciones de trigger no son ejecutables por usuarios de la app. No hay service_role en el cliente ni credenciales nuevas.

Supabase evalúa la autorización Broadcast al conectar y al renovar el JWT; no por cada mensaje. En esta app los propietarios no cambian desde el cliente. El cierre de sesión desmonta las suscripciones; la desactivación de un comercio impide nuevas emisiones a su canal y nuevas lecturas de Radar. Las respuestas con datos completos siempre vuelven a pasar por las consultas protegidas existentes.

Referencia técnica: [Broadcast desde PostgreSQL](https://supabase.com/docs/guides/realtime/broadcast) y [autorización de canales privados](https://supabase.com/docs/guides/realtime/authorization).

## Suscripciones implementadas

| Canal privado | Quién puede entrar | Pantallas / efecto |
| --- | --- | --- |
| `merchant-radar:<businessId>` | Dueño de ese comercio activo | Radar y formulario de oferta: relee sólo la proyección de pedidos; conserva catálogo, filtros, orden y campos escritos del formulario. |
| `buyer-requests:<userId>` | Esa misma cuenta | Mis pedidos, detalle y confirmación: cambios de pedidos y contadores agregados. El retiro conserva el contador histórico y no obliga a recalcularlo. |
| `offers:<requestId>` | Comprador dueño del pedido | Lista y detalle de oferta: creación, retiro y borrado excepcional; también aviso de cierre/cancelación en el detalle de oferta. |
| `merchant-offer:<offerId>` | Dueño del comercio de esa oferta | Detalle del vendedor: mantiene el estado de la oferta entre dispositivos/pestañas. |

Sólo se conectan las pantallas montadas. Hay un registro compartido por cuenta + topic, con conteo de consumidores, para evitar canales duplicados dentro de la pestaña. Al salir, cambiar de recurso/cuenta o desmontar se eliminan listeners, temporizadores y canal. La eliminación y la nueva conexión se serializan para soportar también el montaje doble de desarrollo.

Los avisos se agrupan durante 180 ms y sus handlers se ejecutan de uno en uno. La reconexión usa esperas de 1, 2, 4… hasta 30 segundos y se detiene al desmontar. Son reintentos de conexión, **no polling de datos**. Al suscribirse y volver a conectar hay una lectura de reconciliación para cubrir eventos perdidos y el intervalo entre carga inicial y conexión. No se reproduce un historial infinito de notificaciones.

Los errores conservan el fallback manual. Aparece “Reconectando las actualizaciones en vivo. Podés usar Actualizar.” cuando corresponde. Un fallo de emisión del trigger deja un WARNING en PostgreSQL y no revierte la operación comercial: el usuario puede seguir consultando manualmente.

## Estado, consultas y avisos

- Radar relee la proyección segura porque el aviso deliberadamente no contiene datos. No vuelve a cargar productos/categorías por cada evento. Detecta UUID nuevos para “🔥 Nueva oportunidad: …”; mantiene los filtros seleccionados y las métricas derivadas.
- El formulario relee la oportunidad y muestra “Este pedido ya no acepta ofertas.” al cerrarse, cancelarse o vencer. Si otro dispositivo del comercio ofertó, muestra el aviso de oferta existente. La validación transaccional del envío se mantiene.
- Una oferta nueva necesita la relación pública con el comercio, por eso se relee la lista de ese pedido (o la oferta concreta del vendedor). Las listas se identifican y deduplican por UUID, y no se anexan ciegamente eventos INSERT.
- Un retiro conocido se aplica localmente como WITHDRAWN y mantiene la oferta en el historial. Se muestra “Oferta retirada”. Si falta una carga inicial o hay una lectura concurrente, se reconcilia mediante la consulta protegida para evitar perder datos.
- DELETE de una oferta cargada quita su UUID localmente. Los cambios/borrados de pedidos se reconcilian con la consulta autorizada y el pedido deja de aparecer donde corresponda. No se agregó ninguna operación de borrado físico a la UI.
- Mis pedidos actualiza contadores con la agregación existente en Supabase; se consulta ante INSERT/DELETE de ofertas, no por retiro. Los cambios de pedidos requieren consultar de nuevo para respetar filtros, orden, categoría y paginación.
- Los avisos duran 6,5 segundos, usan los estilos existentes y aria-live. No hay nuevas librerías, notificaciones del sistema ni rediseño.
- El vencimiento por reloj sigue funcionando aunque no haya una escritura que emita un evento. No se escribe EXPIRED automáticamente ni se consulta continuamente.

El fan-out del Radar emite un aviso mínimo por comercio activo, porque actualmente todos pueden consultar las oportunidades abiertas. Es una solución para la escala actual; no agrega colas ni segmentación geográfica. Si crece mucho el número de comercios, ese fan-out deberá optimizarse en otra etapa.

## Pruebas que hacés vos con dos dispositivos

Usá la URL que ya funciona en ambos dispositivos y el mismo proyecto Supabase. En la PC iniciá sesión con el comercio B y en el celular con el comprador A. Si usás un servidor local, el celular debe usar la dirección accesible de la PC en tu red; `127.0.0.1` en el celular apunta al propio celular. No hace falta cambiar la configuración actual si ya accedés desde ambos.

Preparación: ejecutar el SQL; abrir una vez las pantallas con el código nuevo. B debe tener comercio activo, categoría real y un producto activo “Térmica Schneider bipolar 25A”, stock 3 y retiro habilitado. Las recargas iniciales son sólo para tomar el nuevo código; no recargar durante cada prueba.

### Prueba 1: nuevo pedido → Radar

1. PC/B: dejá `/comercio/radar` abierto, filtro Todos.
2. Celular/A: abrí `/pedido/nuevo`, publicá “Térmica bipolar 25A” con la misma categoría, urgencia Hoy y radio 20 km. Dejalo OPEN.
3. Sin tocar Actualizar en PC: debe aparecer el pedido y el aviso “🔥 Nueva oportunidad”. Deben cambiar las métricas.
4. Seleccioná Necesita hoy en PC. Creá otro pedido con urgencia Mañana desde el celular: no debe mostrarse en esa lista; el filtro debe permanecer seleccionado. Con Coincide con mi catálogo sólo deben mostrarse coincidencias.

### Prueba 2: oferta → comprador

1. Celular/A: dejá abierto el detalle `/pedido/UUID` del primer pedido, con Ofertas recibidas visible.
2. PC/B: desde Radar elegí Enviar esta oferta, revisá producto, precio y descripción. Si habilitás envío, completá costo y tiempo estimado. Enviá.
3. Sin recargar el celular: debe aparecer una sola oferta y “🎉 Nueva oferta recibida”, con comercio y precio.
4. Si querés comprobar el estado del Radar en paralelo, dejalo en otra pestaña de PC antes de enviar: debe mostrar “✅ Ya enviaste una oferta” y Ver mi oferta automáticamente.
5. Para comprobar el contador, dejá `/pedidos` abierto en otra pestaña del comprador y enviá una oferta a otro pedido: su contador debe cambiar solo.

### Prueba 3: retiro → estado automático

1. Celular/A: mantené el pedido o detalle de oferta abierto.
2. PC/B: abrí Ver mi oferta y pulsá Retirar oferta.
3. En celular debe aparecer “Oferta retirada” y cambiar el estado sin recargar. La fila permanece en el historial; el contador histórico no disminuye. WhatsApp deja de estar habilitado para esa oferta retirada.

### Prueba 4: cierre/cancelación → sale del Radar

1. PC/B: mantené Radar abierto con el pedido visible. Opcionalmente abrí su formulario de oferta en otra pestaña (después del retiro ya puede abrirse de nuevo).
2. Celular/A: cerrá el pedido y confirmá.
3. Sin recargar PC: debe desaparecer del Radar. El formulario abierto debe mostrar “Este pedido ya no acepta ofertas.”
4. Repetí con otro pedido, eligiendo Cancelar. También debe desaparecer. El comprador ve el aviso de cierre/cancelación cuando recibe el cambio.

### Prueba 5: sin duplicados y reconexión

1. Repetí el flujo con un pedido nuevo. Abrí dos formularios del mismo comercio antes de enviar. Enviá desde uno y revisá el otro: debe mostrar que ya hay oferta. Si alcanzás a enviar desde ambos, el SQL previo devuelve la oferta activa existente.
2. Comprobá que el comprador tenga una sola card por UUID y el contador correcto. Usar Actualizar después no debe duplicar filas.
3. Desconectá brevemente la conexión del celular, retirando una oferta desde PC mientras tanto. Volvé a conectarlo: la reconciliación debe recuperar el estado; Actualizar permanece disponible si la conexión aún falla.
4. Navegá varias veces entre Radar, formulario y detalle. No deben multiplicarse avisos por cada visita.

Seguridad adicional: con una tercera cuenta, los enlaces privados de A/B deben seguir sin mostrar datos. La cuenta C no puede suscribirse a `offers:<pedido-de-A>` ni a los canales del comercio B. Si C tiene su propio comercio activo, recibe sólo el aviso vacío de su propio Radar y la proyección pública permitida, nunca ofertas ajenas. Sin SQL instalado no esperes actualizaciones automáticas; el fallback manual sigue funcionando.

## Archivos creados

- `supabase/realtime.sql`: publicación idempotente, autorización y triggers de avisos mínimos.
- `src/lib/realtime.ts`: canales privados compartidos, parsing, limpieza y reconexión.
- `src/components/requests/use-live-changes.tsx`: agrupación de eventos, avisos temporales y estado de conexión.
- `src/components/requests/use-live-offers.ts`: ofertas en vivo y reconciliación por UUID.
- `src/components/radar/use-live-radar.ts`: refresco de la proyección segura sin recargar catálogo.
- `REALTIME_SETUP.md`: esta guía.

## Archivos modificados

- `src/components/requests/use-account-data.ts`: parche local, lecturas parciales por recurso y protección contra respuestas atrasadas.
- `src/components/requests/buyer-request-data.tsx`: suscripción de pedidos propios y contadores.
- `src/components/requests/buyer-requests.tsx`: avisos y fallback manual en lista/detalle.
- `src/components/requests/real-offers.tsx`: conexión al hook de ofertas y estado de retiro.
- `src/components/requests/real-offer-form.tsx`: vigencia del pedido en vivo sin resetear los campos.
- `src/components/requests/request-shell.tsx`: explicación de actualizaciones en vivo.
- `src/components/radar/radar.tsx`: suscripción, avisos y preservación de filtros.
- `src/lib/real-radar.ts`: separar lectura de oportunidades y deduplicar UUID.
- `src/lib/real-offers.ts`: deduplicar UUID al completar lecturas paginadas.
- `README.md`: enlace y estado actual.
- `RADAR_OFFERS_SETUP.md`: referencia a esta nueva etapa.

No se ejecutaron pruebas automáticas, suites, build, lint, typecheck, E2E ni SQL remoto; no se abrió navegador ni se hizo validación visual. Queda pendiente instalar el SQL y realizar estas pruebas manuales. No se agregaron Realtime a reservas ni funciones de Push, pagos, chat, mapas o IA.

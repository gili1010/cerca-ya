# Reservas reales y Realtime

## SQL manual

Ejecutá **todo `supabase/reservation-rls.sql`** en Supabase → SQL Editor → New query, con el rol `postgres`. Requiere el esquema existente, Auth/perfiles, comercios/productos y Realtime ya configurados en las etapas anteriores. No repitas `schema.sql`, seeds, `request-rls.sql`, `radar-offer-rls.sql` ni `realtime.sql`.

Este único archivo contiene los permisos/RLS, las tres RPC, la publicación de reservations y sus triggers/canales privados. No hace falta un segundo archivo reservation-functions.sql. No se ejecuta ALTER TABLE sobre realtime.messages: Supabase ya administra su RLS. Las policies de Realtime sólo se agregan para los nuevos prefijos de reservas y no reemplazan las de pedidos/ofertas.

No se importa localStorage ni se eliminan reservas históricas. Las rutas reales rechazan IDs mock y usan únicamente UUID de Supabase. Si había filas en la tabla reservations de un seed antiguo, no se convierten ni eliminan: sólo sus participantes pueden leerlas según las políticas.

El archivo puede reaplicarse con sus nombres existentes: reemplaza funciones, recrea sus propias policies/triggers y agrega reservations a supabase_realtime sólo si falta. No cambia schema.sql ni ejecuta cron.

## RPC creadas

| RPC | Entradas | Operación |
| --- | --- | --- |
| `create_my_reservation` | UUID de intento, UUID del producto seleccionado, cantidad, PICKUP/DELIVERY | Comprueba usuario, producto real activo, negocio activo, cantidad y modalidad. Obtiene buyer_id de auth.uid(), business_id del producto, precio del producto y envío del negocio. Crea PENDING por 30 minutos sin descontar stock. |
| `manage_my_reservation` | UUID de reserva, acción confirm/cancel/ready/complete | Máquina de estados transaccional, con validación de usuario y bloqueo de filas. Centraliza confirmar, cancelar/rechazar, marcar lista y completar. |
| `read_my_reservations` | Modo comprador/comercio, UUID opcional, página | Devuelve exclusivamente reservas propias del comprador o del comercio propietario. Incluye producto, comercio, imagen, stock actual y fechas, incluso si el producto o negocio se desactivó. |

El ID de producto es el recurso elegido desde `/producto/[id]`: se recibe como identificador y se valida contra PostgreSQL. El formulario no envía buyer_id, business_id, precio, stock, total ni estado. El UUID del intento permite recuperar la misma reserva si se pierde una respuesta; no decide su propietario. Durante ese reintento se conservan cantidad/modalidad e ID. El precio guardado es el vigente en la base al crear, y el total usa la columna GENERATED existente. El formulario avisa que el detalle muestra el total final.

Se revocan INSERT/UPDATE/DELETE directos para usuarios, incluidos los grants por columna del esquema inicial. Las escrituras se realizan sólo mediante las RPC autorizadas. No se usa service_role.

## Estados, permisos y stock

| Estado actual | Quién / acción | Resultado | Stock |
| --- | --- | --- | --- |
| PENDING vigente | Comercio: confirmar | CONFIRMED + confirmed_at | Descuenta cantidad una vez |
| PENDING vigente | Comprador o comercio: cancelar/rechazar | CANCELLED + cancelled_at | Sin cambios |
| CONFIRMED | Comprador o comercio: cancelar | CANCELLED + cancelled_at | Devuelve cantidad una vez |
| CONFIRMED | Comercio: lista | READY + ready_at | Sin cambios |
| READY | Comercio: entregada | COMPLETED + completed_at | Sin cambios |
| PENDING vencida | Lectura de UI | Se muestra EXPIRED | Sin cambios; no se escribe EXPIRED |

No se permite cancelar READY/COMPLETED, ni confirmar una PENDING vencida. El comprador no puede confirmar, marcar lista ni completar. Terceros no pueden leer ni gestionar reservas ajenas. Los reintentos de una acción cuyo estado destino ya se alcanzó devuelven la misma reserva sin repetir los efectos.

**Protección concurrente:** cada gestión bloquea primero la fila de la reserva con FOR UPDATE; confirmar y cancelar CONFIRMED bloquean después el producto con FOR UPDATE, siempre en ese orden. Bajo el bloqueo se lee el stock vigente, se comprueba que alcance y se descuenta/devuelve. La transición de reserva y el stock quedan dentro de la misma transacción. Si falla algo, ambos cambios se revierten.

Dos reservas distintas compiten por el mismo bloqueo del producto: con stock 1, la primera confirmación deja stock 0 y la segunda recibe “No hay stock suficiente para confirmar esta reserva.” sin cambiar a CONFIRMED. Dos cancelaciones compiten por la misma fila de reserva: la segunda encuentra CANCELLED y no devuelve unidades nuevamente. Confirmación y cancelación simultáneas también quedan serializadas.

Se actualiza stock_status a OUT_OF_STOCK en 0, LOW_STOCK en 1–2 e IN_STOCK desde 3, y stock_confirmed_at al modificar inventario. Se controla también el límite entero al devolver unidades. No hay descuento al crear PENDING, al marcar READY ni al completar. Las reservas ya creadas pueden continuar aunque se desactive el producto/negocio; las nuevas no se admiten en ese caso.

La gestión manual de cantidades del catálogo sigue siendo una operación del comercio existente. No se añadió sincronización Realtime a productos ni stock: para ver cantidades en otra pantalla del catálogo, actualizala. El detalle de la reserva consulta el stock tras sus cambios.

## Realtime y UI

Se agrega **sólo reservations** a la publicación supabase_realtime en esta etapa. Se reutiliza Broadcast privado y la infraestructura de suscripción, agrupación, reconexión y limpieza ya instalada:

- `buyer-reservations:<userId>`: sólo ese comprador. Lista, detalle y confirmación.
- `merchant-reservations:<businessId>`: sólo el dueño de ese comercio, incluso si está inactivo para poder continuar reservas existentes. Lista y detalle del comercio.

El trigger envía únicamente UUID, operación y estado. Las lecturas posteriores obtienen relaciones, precios guardados y fechas a través de read_my_reservations con controles de propietario. No se publican perfiles, teléfonos, precios ni filas completas en los mensajes. Policies restrictivas protegen estos namespaces frente a policies permisivas previas e impiden publicaciones del cliente.

El comprador ve avisos de confirmación, lista para retirar/enviar y completada; el comercio ve “🛒 Nueva reserva recibida”. Se conservan los botones Actualizar. Se recuperan cambios después de reconectar y se deduplican filas por UUID. Los eventos de otras reservas se ignoran cuando se está mirando un detalle concreto. No hay polling, push ni suscripciones nuevas a otros módulos.

La lista del comercio incluye todos los estados y muestra el contador real de PENDING vigentes. No había contador de reservas en el panel general, por lo que no se reconstruyó ese dashboard. Los filtros y la línea de progreso reutilizan los componentes y estilos anteriores. Las pendientes vencidas se muestran como vencidas con el reloj de pantalla, sin cron ni escritura automática.

## Pruebas manuales con PC y celular

Preparación: ejecutar el nuevo SQL y abrir las pantallas con el código actualizado. Usar el mismo proyecto Supabase y la URL accesible desde ambos dispositivos. En el celular entrar como comprador A; en PC como dueño del comercio B. Para esta prueba la cuenta B debe tener un producto real activo, negocio activo, retiro habilitado y stock al menos 3. No cambiar manualmente stock durante cada escenario.

### Flujo normal

1. PC/B: dejá `/comercio/reservas` abierto, filtro Todos.
2. Celular/A: abrí `/producto/UUID`, pulsá Reservar, elegí cantidad 1 y Retiro. Revisá el resumen y enviá.
3. Debe abrirse la confirmación y el detalle propio. Verificá producto, comercio, cantidad, total y estado PENDING. El stock todavía debe ser el inicial.
4. PC/B: la nueva reserva debe aparecer sin recargar, con “🛒 Nueva reserva recibida”. Abrí Ver reserva y pulsá Confirmar reserva.
5. Celular/A: dejá `/reserva/UUID` abierto. Debe cambiar automáticamente a CONFIRMED y mostrar “✅ Tu reserva fue confirmada”. El stock del detalle comercial debe haber disminuido en 1.
6. PC/B: pulsá Marcar como lista. Celular: debe mostrar READY, “Lista para retirar” y su aviso, sin recargar.
7. PC/B: pulsá Marcar como entregada. Celular: debe mostrar COMPLETED y “✅ Reserva completada”. No debe volver a descontarse stock.
8. Para envío, repetí con ambas opciones habilitadas en producto y negocio. El costo debe ser el del comercio, el total cantidad × precio + envío y el texto READY debe decir listo para enviar.

### Stock insuficiente y concurrencia

1. PC/B: prepará otro producto activo con stock exactamente 1.
2. Celular/A: creá dos reservas distintas de una unidad, reabriendo el formulario entre ellas, **antes de confirmar alguna**. También podés crear la segunda con otra cuenta compradora. Ambas deben quedar PENDING; stock sigue en 1.
3. PC/B: confirmá la primera. Stock debe quedar en 0.
4. Intentá confirmar la segunda: debe mostrar “No hay stock suficiente para confirmar esta reserva.”; sigue PENDING y stock sigue 0.
5. Para probar la carrera real, repetí con otro producto stock 1 y dos PENDING. Abrí sus detalles en dos pestañas comerciales y confirmá casi a la vez. Sólo una puede confirmarse.
6. Abrí/recargá el producto con stock 0: Reservar debe estar deshabilitado. Si un formulario estaba abierto antes de agotarse, al enviarlo debe rechazar la creación sin confiar en el stock viejo del navegador.

### Cancelación

1. Prepará un producto con stock 3. Creá una reserva de 1 y cancelala desde el celular mientras está PENDING. Debe quedar CANCELLED y stock seguir en 3.
2. Creá otra de 1, confirmala desde PC: stock 2. Cancelala desde el celular: estado CANCELLED y stock 3.
3. Dejá previamente abiertos los detalles en dos pestañas de la cuenta compradora o una del comercio y otra del comprador. Intentá cancelar desde ambas: stock debe permanecer en 3, nunca 4. La segunda ejecución puede recuperar el estado ya cancelado.
4. Rechazá otra PENDING desde PC: debe pasar a CANCELLED sin tocar stock.

### Seguridad, vencimiento y desactivación

1. Copiá las URLs `/reserva/UUID` y `/comercio/reserva/UUID`.
2. Entrá con una tercera cuenta C sin relación con la reserva. Pegá ambos enlaces: debe aparecer “Esta reserva no está disponible para tu cuenta.” No debe poder realizar acciones. Sin sesión debe redirigir al login.
3. Con A, la ruta comercial de una reserva de B no debe mostrarla. Con B, la ruta de comprador de A tampoco. El SQL Editor como administrador no sirve para probar aislamiento de usuarios.
4. Para verificar RPC en una prueba manual de API autenticada, una llamada manage_my_reservation con el JWT de C debe fallar; con el de A, acciones confirm/ready/complete también deben fallar. No uses service_role para esta prueba. La UI ya oculta esas acciones al comprador.
5. Dejá una PENDING más de 30 minutos: debe mostrarse vencida y no permitir confirmar/cancelar. No se debe haber descontado stock.
6. Abrí un formulario y desactivá el producto antes de enviarlo. La creación debe fallar con “Este producto ya no está disponible.” Una reserva creada antes de desactivarlo puede seguir confirmándose, preparándose y completándose si tiene stock.
7. Desconectá brevemente el celular y avanzá un estado en PC. Al reconectarlo debe recuperar el estado; Actualizar sigue disponible como respaldo.

## Archivos creados

- `supabase/reservation-rls.sql`.
- `src/lib/real-reservations.ts`.
- `src/components/reservations/use-real-reservations.ts`.
- `src/components/reservations/real-reservation-common.tsx`.
- `RESERVATION_SETUP.md`.

## Archivos modificados

- `src/types/database.ts`: contratos de vista y RPC.
- `src/lib/realtime.ts`: reconocer avisos de reservas, conservando los anteriores.
- `src/components/reservations/reservation-form.tsx`: creación real e idempotencia.
- `src/components/reservations/reservation-list.tsx`: listas reales, filtro y pendientes.
- `src/components/reservations/reservation-detail.tsx`: estados y acciones transaccionales.
- `src/components/reservations/reservation-confirmation.tsx`: confirmación real.
- `src/components/reservations/reservation-common.tsx`: reutilizar badge/progreso con datos reales.
- `src/app/producto/[id]/reservar/page.tsx`: sólo producto Supabase, sin fallback mock.
- `src/app/reservas/page.tsx`.
- `src/app/reserva/[id]/page.tsx`.
- `src/app/reserva/[id]/confirmacion/page.tsx`.
- `src/app/comercio/reservas/page.tsx`.
- `src/app/comercio/reserva/[id]/page.tsx`.
- `src/proxy.ts`: proteger las rutas de reserva.
- `src/components/details/public-product-detail.tsx`: explicación del flujo real.
- `src/components/requests/request-shell.tsx`: aviso de persistencia actualizado.
- `src/components/radar/merchant-workspace.tsx`: texto del panel actualizado.
- `src/components/auth/account.tsx`: texto de cuenta actualizado.
- `src/components/home/home-dialogs.tsx`: textos de reservas actualizados.
- `README.md` y `RESERVAS.md`: documentación vigente y referencia desde la demo histórica.

Las rutas públicas de reservas no leen ni escriben request-store/localStorage. El código del store y los mocks anteriores se conservan para las demos que aún los usan; no se importaron datos ni se hizo dual-write. No se cambió la lógica de Pedido Abierto/Radar/Offers ni la aceptación de ofertas. No se instalaron dependencias nuevas.

No se ejecutó SQL remoto, navegador, pruebas automáticas, suites, build, lint, typecheck ni E2E. La instalación del SQL y los escenarios anteriores quedan para tu prueba manual. No se implementaron pagos, push, chat, logística, mapas ni IA.

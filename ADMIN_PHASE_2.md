# Panel Admin — Fase 2

## Activación

Ejecutar **únicamente `supabase/admin-phase-2.sql`**, completo, en Supabase SQL Editor con rol `postgres`. Requiere la Fase 1 funcionando y los deltas de pedidos multiproducto (`reservation-items.sql`) y checkout ya aplicados. No volver a ejecutar migraciones históricas. No requiere dependencias, variables de entorno, service role ni nuevos permisos en Auth.

Se conserva `private.admin_users`, `is_admin()`, la autorización en servidor y `private.require_admin()`. Las funciones de autorización también rechazan una cuenta suspendida si un operador la agregara manualmente como ADMIN. Todas las páginas, acciones de servidor y RPC administrativas comprueban permisos. Las cuentas administradoras no se pueden suspender desde esta fase, para evitar quitarse acceso accidentalmente.

## Usuarios

`/admin/usuarios` lista 25 cuentas por página. Lee sólo UUID, nombre del perfil, email, fecha de registro y estado desde una RPC ADMIN. Busca nombre/email/teléfono en PostgreSQL y filtra activos/suspendidos. El teléfono se puede buscar pero **no se devuelve en el listado**. Incluye cantidad de pedidos y acceso al comercio asociado.

`/admin/usuarios/[id]` muestra contacto básico para soporte, estado, comercio, total de pedidos y los últimos 10 pedidos, con enlace al listado completo filtrado por UUID del comprador. No se devuelve metadata de Auth, tokens, hashes ni claves.

Suspender/reactivar usa `private.user_suspensions`, sin modificar `auth.users` ni borrar perfiles o relaciones. Suspender exige motivo y admite nota de hasta 500 caracteres. Reactivar elimina el bloqueo de aplicación; la auditoría se conserva. Las acciones son transaccionales y repetidas sobre el mismo estado no duplican eventos.

Antes de suspender, la misma RPC verifica pedidos del comprador y de los comercios de los que sea propietario. `PENDING` no vencido, `CONFIRMED` y `READY` impiden la suspensión con el error controlado `USER_HAS_ACTIVE_ORDERS`. La UI pide resolver primero esos pedidos; no se escribe suspensión ni auditoría de éxito. `COMPLETED`, `CANCELLED`, `EXPIRED` y `PENDING` vencido no la impiden. La creación de pedidos bloquea ambos participantes de manera compatible con la suspensión, para evitar la carrera entre la comprobación y un nuevo pedido; no se crean pedidos a un dueño suspendido.

Storage tenía policies de propiedad sin comprobación de suspensión: INSERT/UPDATE/DELETE en `product-images` e INSERT/DELETE en `business-assets` (este último no concede UPDATE). El delta agrega tres policies **restrictivas**, sólo de escritura, para todos los buckets accesibles a `authenticated`, exigiendo `NOT public.is_my_account_suspended()`. Se conservan las policies de propiedad, borrado de imágenes sin uso y lectura; no se habilitan operaciones antes prohibidas. Los usuarios suspendidos siguen viendo imágenes públicas. La auditoría se basa en los SQL locales, sin consultar policies remotas.

Un usuario suspendido puede iniciar sesión y consultar el historial existente, pero no puede crear/editar comercios, publicar/editar productos o imágenes del catálogo, operar pedidos/reservas, pedidos abiertos, ofertas, favoritos, ni enviar reportes. El trigger también cubre `public.messages` si esa tabla existe. Se bloquean escrituras en PostgreSQL, incluso las realizadas mediante RPC SECURITY DEFINER con sesión de usuario. No se reemplazan las RPC comerciales ni sus reglas de inventario.

La validación bloquea una fila de `auth.users` en modo compartido durante las escrituras para serializarlas con una suspensión concurrente. No modifica esa fila. Procesos privilegiados sin sesión conservan su comportamiento actual; las reglas de autorización existentes siguen impidiendo escrituras anónimas.

Se muestra **“Tu cuenta está suspendida.”** al cargar, navegar o volver a enfocar la aplicación. Los formularios principales muestran el mismo mensaje cuando PostgreSQL rechaza la acción. No se cambia el carrito local ni el flujo de login/logout. Suspender al dueño **no suspende automáticamente su comercio ni cambia sus productos**: esa moderación sigue siendo una decisión separada de Fase 1.

## Pedidos y soporte

`/admin/pedidos` muestra número corto, fecha, comprador, comercio, cantidad de líneas de productos, total, modalidad y estado. Busca por ID corto/completo, comprador por nombre/UUID y comercio; filtra estado, retiro/envío y fechas inclusivas usando horario argentino. Paginación de 25.

`/admin/pedidos/[id]` es exclusivamente de consulta: snapshots de nombres, cantidades y precios, imágenes actuales disponibles, total, método de pago, entrega y timeline. Contacto/dirección/referencia se leen desde `private.reservation_checkout` **sólo para el detalle**, con aviso “Información privada — usar sólo para soporte”. Pedidos antiguos sin checkout muestran que no hay registro, sin inventar datos.

El número corto conserva los primeros seis caracteres del UUID sin guiones, como la UI actual. Permite copiar ese número y el UUID completo; el UUID queda en un detalle desplegable. Un número corto puede tener coincidencias: para soporte preciso usar el ID completo.

Los pedidos pendientes cuya fecha límite pasó se muestran como vencidos, igual que la UI normal, sin escribir una transición en el historial. La fecha límite aparece en el timeline. **No existe ninguna acción administrativa para confirmar, cancelar, completar, cambiar entrega, total o productos.**

## Reportes

La tienda y el detalle público de producto incorporan un botón secundario Reportar. Sin sesión ofrece ingresar con el login existente y volver al recurso. El modal solicita motivo y comentario opcional de hasta 1000 caracteres. Sólo permite comercio/producto público activo.

Los datos están en `private.reports`, con RLS y sin permisos directos de lectura/escritura para usuarios comunes. La RPC usa `auth.uid()` como reportante: el cliente no puede atribuir el reporte a otro usuario, cambiar la resolución ni leer denuncias ajenas.

Un índice UNIQUE parcial impide más de un reporte OPEN por usuario y recurso. Un bloqueo transaccional por usuario serializa el conteo de un límite adicional de **20 reportes por 24 horas**, incluso entre varias pestañas. Tras cerrar una denuncia puede enviarse otra, sujeta a ese límite.

`/admin/reportes` filtra pendientes/resueltos/descartados; por defecto pendientes y más recientes primero, con 25 registros por página. `/admin/reportes/[id]` muestra motivo, comentario, reportante y recurso, con acceso a su pantalla administrativa y pública. `/admin/productos/[id]` facilita revisar el producto denunciado y **reutiliza exactamente la acción de bloqueo de Fase 1**.

Resolver/descartar abre confirmación con nota administrativa opcional. La RPC bloquea el reporte, exige estado OPEN y registra resolución + auditoría en una transacción. Un segundo administrador que lo intente cerrar recibe un mensaje para actualizar. **Cerrar una denuncia no bloquea ni suspende recursos automáticamente.**

## Auditoría, métricas y RPC

Se conservan los eventos anteriores y se agregan `USER_SUSPENDED`, `USER_REACTIVATED`, `REPORT_RESOLVED`, `REPORT_DISMISSED`. La tabla y su protección contra edición/eliminación siguen siendo las de Fase 1. La vista usa la proyección ampliada sin teléfonos, emails o direcciones.

Dashboard agrega usuarios activos, usuarios suspendidos y reportes pendientes. Las métricas de comercios/productos/pedidos se reutilizan; no hay gráficos ni buscador global duplicado. Las búsquedas específicas de Usuarios, Pedidos y Comercios son las herramientas de soporte.

RPC nuevas:

- `is_my_account_suspended()`: sólo estado del usuario de la sesión.
- `admin_read_phase2(...)`: lecturas ADMIN explícitas, máximo 50 registros (el panel pide 25), detalle de un recurso, últimos 10 pedidos por usuario.
- `admin_set_user_suspension(...)`: suspensión/reactivación y auditoría.
- `create_my_report(...)`: usuario autenticado activo, validación de recurso/motivo y protección de spam.
- `admin_resolve_report(...)`: cierre ADMIN transaccional y auditado.

No se modifica `admin-phase-1.sql`, `schema.sql` ni SQL históricos. El delta agrega tablas inicialmente vacías, de modo que todas las cuentas existentes quedan activas en la aplicación y no se crean denuncias automáticas. Comercios, productos, stock, URLs, pedidos e historial conservan sus valores.

## Prueba manual exacta

Usar tres sesiones: ADMIN existente, usuario común de prueba y ventana sin sesión. Elegir un comercio/producto de prueba y tener al menos un pedido de prueba ya creado. No suspender una cuenta necesaria para operar producción durante esta comprobación.

1. Aplicar el SQL delta con rol `postgres`. Entrar con ADMIN a `/admin`: revisar Usuarios, Pedidos, Reportes y las nuevas métricas. No volver a registrar el ADMIN de Fase 1.
2. Desde las sesiones común y anónima abrir `/admin/usuarios`, `/admin/pedidos`, `/admin/reportes` y sus detalles. La cuenta común vuelve a Home; la anónima debe iniciar sesión. No deben aparecer datos administrativos.
3. En Usuarios buscar nombre, email y teléfono de la cuenta de prueba. Revisar filtros y paginación si hay más de 25. Confirmar que no aparecen teléfonos en el listado.
4. Abrir el usuario: comprobar email/teléfono, comercio asociado, total y últimos 10 pedidos; usar “Ver todos los pedidos”.
5. Con una cuenta compradora y otra propietaria de un comercio con pedidos `PENDING` no vencidos, `CONFIRMED` o `READY`, intentar suspender: debe aparecer el mensaje para resolver primero los pedidos y conservarse el estado activo. Completar/cancelar los pedidos por los flujos normales, o usar cuentas de prueba sin pedidos activos. Pulsar Suspender, elegir motivo/nota y cancelar primero: no debe cambiar nada. Repetir y confirmar. Volver a enfocar o recargar la sesión de ese usuario: debe aparecer el aviso de suspensión. Los pedidos vencidos/completados/cancelados no deben impedirlo.
6. Con esa sesión intentar crear un pedido, publicar/editar un producto, crear/editar comercio y enviar oferta/pedido abierto/reporte. Deben rechazarse sin crear ni modificar datos. Consultar un pedido histórico: debe seguir accesible. Logout/login debe seguir funcionando.
7. Para verificar que no depende de los botones, usar la sesión común suspendida al invocar las RPC comerciales habituales o una escritura directa permitida por RLS sobre su recurso: debe fallar por suspensión. En Storage intentar subir, reemplazar o eliminar archivos propios sin uso: debe rechazar escrituras, pero permitir ver imágenes públicas. Probar con una cuenta activa las mismas operaciones permitidas por sus policies originales; deben seguir funcionando. Otro comprador activo tampoco debe poder crear un pedido al comercio de un dueño suspendido. No usar service role ni SQL Editor para simular a ese usuario.
8. Reactivar desde el detalle ADMIN. Recargar la sesión de prueba: el aviso debe desaparecer y las acciones normales volver a permitirse. Confirmar ambos eventos en Auditoría.
9. En Pedidos buscar por número corto y UUID completo, comprador y comercio; probar estado, retiro/envío y fechas. Verificar el detalle, snapshots, contacto con aviso privado, timeline y ambos botones de copiar. No debe haber botones para alterar el pedido.
10. Desde la cuenta común activa abrir un producto y Reportar. Elegir motivo, escribir comentario y enviar. Repetir el mismo recurso: debe indicar que ya hay una denuncia pendiente. Probar también reportar una tienda.
11. Desde una ventana sin sesión tocar Reportar: debe ofrecer login. Como usuario común no debe poder leer `private.reports`, inventar otro reportante ni invocar `admin_resolve_report`/`admin_read_phase2` con éxito.
12. En Reportes ADMIN comprobar los pendientes, abrir uno, acceder al producto/comercio administrativo, resolver con nota. Confirmar que el recurso no se bloqueó automáticamente. Filtrar Resueltos y revisar la nota.
13. Abrir el otro reporte y descartarlo con nota. Comprobar Descartados, Auditoría y descenso del contador pendiente. Si se decide moderar un recurso, hacerlo por separado con las acciones de Fase 1.
14. Revisar que los listados/auditoría no contienen teléfonos ni direcciones; que las rutas móviles permiten desplazamiento horizontal sin desbordar la página; y que los históricos y stock conservan sus valores.
15. El límite de reportes es por usuario y 24 horas. Si necesitás comprobarlo, usar una cuenta y recursos de prueba; al alcanzar 20, el siguiente debe rechazarse. La unicidad también protege envíos simultáneos desde dos pestañas.

No se ejecutaron tests, build, navegador, E2E, lint ni SQL remoto. Se realizó únicamente lectura y revisión estática del código.

## Archivos de esta fase

Nuevos:

- `supabase/admin-phase-2.sql`
- `ADMIN_PHASE_2.md`
- `src/lib/admin/phase2-types.ts`
- `src/lib/admin/phase2-actions.ts`
- `src/components/admin/support-common.tsx`
- `src/components/admin/copy-order-id.tsx`
- `src/components/admin/report-resolution.tsx`
- `src/components/auth/account-suspension-notice.tsx`
- `src/components/auth/account-suspension.module.css`
- `src/components/reports/report-button.tsx`
- `src/components/reports/report.module.css`
- `src/app/admin/usuarios/page.tsx`
- `src/app/admin/usuarios/[id]/page.tsx`
- `src/app/admin/pedidos/page.tsx`
- `src/app/admin/pedidos/[id]/page.tsx`
- `src/app/admin/reportes/page.tsx`
- `src/app/admin/reportes/[id]/page.tsx`
- `src/app/admin/productos/[id]/page.tsx`
- `src/app/admin/not-found.tsx`

Modificados (sobre el estado ya existente de Fase 1):

- `src/types/database.ts`
- `src/lib/admin/types.ts`
- `src/lib/admin/server.ts`
- `src/components/admin/admin-status-action.tsx`
- `src/app/admin/layout.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/auditoria/page.tsx`
- `src/app/layout.tsx`
- `src/components/stores/store-header.tsx`
- `src/components/details/public-product-detail.tsx`
- `src/lib/merchant-products/form.ts`
- `src/lib/businesses/form.ts`
- `src/lib/real-offers.ts`
- `src/lib/real-reservations.ts`
- `src/components/requests/new-request.tsx`

Los demás cambios previos de Fase 1 en el working tree se conservaron.

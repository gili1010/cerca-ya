# Administración — Fase 1

## Habilitar el panel

1. En Supabase, abrir **SQL Editor**, con el rol `postgres`, y ejecutar el contenido completo de `supabase/admin-phase-1.sql`. Requiere los deltas de inventario y pedidos que ya usa la aplicación. No ejecutar nuevamente los SQL históricos.
2. Abrir **Authentication → Users**, seleccionar tu cuenta existente y copiar su **User UID**. No usar el identificador de un comercio ni un email.
3. En SQL Editor, reemplazar el ejemplo y ejecutar:

```sql
insert into private.admin_users(user_id)
values ('REEMPLAZAR-POR-EL-UUID-DE-TU-USUARIO'::uuid)
on conflict do nothing;
```

4. Iniciar sesión normalmente con esa cuenta y abrir `/admin`. No hay contraseña, login o rol de perfil nuevo. No requiere variables nuevas ni service role.

Para revocar el permiso, sólo desde SQL Editor:

```sql
delete from private.admin_users
where user_id = 'REEMPLAZAR-POR-EL-UUID-DE-TU-USUARIO'::uuid;
```

## Acceso y datos

Cada página y acción verifica la sesión en el servidor y llama a `is_admin()`. Sin sesión redirige al login actual; con sesión sin permiso redirige a Home. Las RPC de lectura y escritura comprueban nuevamente el usuario con `auth.uid()` y su pertenencia a `private.admin_users`. No usan roles del frontend ni metadata editable por el usuario.

Las tablas administrativas están en `private`, con RLS y sin permisos para `anon`/`authenticated`. No hay RPC para concederse permisos. Las lecturas administrativas son proyecciones explícitas: nombre básico del propietario, sin email, teléfono, coordenadas, medios de pago ni datos de compradores/pedidos.

### Rutas

- `/admin`: perfiles de usuarios, comercios totales/activos, productos activos de comercios activos, pedidos totales y creados en los últimos 7 días. Los pedidos se cuentan por encabezado de reserva, una vez incluso si contienen varios productos. No se leen detalles privados.
- `/admin/comercios`: búsqueda por nombre, filtro por estado, 25 registros por página.
- `/admin/comercios/[id]`: datos públicos, categorías, entrega, estado, cantidad de productos y acceso a la tienda pública.
- `/admin/productos`: foto, producto, comercio, categoría, precio, modalidad, estado y fecha. Búsquedas por producto/comercio y filtro por estado.
- `/admin/auditoria`: registro paginado, más recientes primero, sólo lectura.

El filtro **Inactivos (todos)** incluye recursos inactivos por el propietario y bloqueos administrativos. **Suspendidos/Bloqueados por administración** permite ver exclusivamente las marcas administrativas. Un producto activo de un comercio inactivo se identifica como no visible públicamente.

## Suspensión y bloqueo

Cada acción abre una confirmación. Suspender/bloquear exige un motivo del listado; admite una nota de hasta 500 caracteres. Retirar un bloqueo permite una nota opcional.

Se reutiliza `active = false` y se agrega únicamente `businesses.admin_suspended_at` / `products.admin_blocked_at`. Home, búsqueda, tienda y detalle públicos ya filtran por recursos y comercios activos. Los productos del comercio suspendido conservan sus propios estados. No se alteran stock, cantidades, slugs, reservas, pedidos ni registros históricos.

Al retirar la marca administrativa se restaura el estado anterior registrado en la auditoría: un recurso previamente inactivo sigue inactivo. El botón Reactivar retira el bloqueo; no fuerza la publicación de productos que su dueño ya tenía desactivados.

Un trigger rechaza reactivar recursos con marca administrativa y modificar esa marca fuera del RPC autorizado. Comprueba el rol efectivo, el marcador transaccional y el permiso ADMIN. No basta con configurar el marcador desde un cliente. El propietario puede seguir editando información y confirmando stock de un producto bloqueado, sin publicarlo. Ve sólo el aviso genérico de administración, nunca los motivos internos.

La acción bloquea la fila, verifica el recurso y escribe estado + auditoría en una transacción. Una acción repetida sobre el mismo estado no duplica logs. La migración no actualiza datos existentes: conserva tanto los activos como los inactivos y no suspende/bloquea ninguno.

## Auditoría y RPC

`private.admin_audit_logs` registra UUID del administrador, acción, recurso, motivo, nota, fecha y estado previo. No tiene permisos directos de escritura para usuarios de la aplicación y un trigger rechaza UPDATE/DELETE. La aplicación no ofrece edición ni eliminación. El operador privilegiado de la base sigue controlando su infraestructura; la inmutabilidad aplica al panel y usuarios de la aplicación.

RPC públicas:

- `is_admin()`: verifica pertenencia administrativa del usuario actual.
- `admin_read(...)`: dashboard, comercios, detalle, productos o auditoría; búsqueda y paginación en PostgreSQL, máximo 50 filas por llamada (el panel solicita 25).
- `admin_set_resource_status(...)`: suspender/reactivar comercio o bloquear/desbloquear producto según entidad y estado solicitado. Valida motivo, usuario y recurso, con registro transaccional.

Las funciones auxiliares privadas no son invocables por usuarios comunes. Ningún RPC modifica perfiles, slugs o stock.

## Prueba manual

1. Aplicar el delta y dar de alta tu UUID como ADMIN. Verificar que comercios y productos anteriores mantienen sus estados.
2. Sin sesión, abrir cada ruta `/admin`, `/admin/comercios`, `/admin/productos`, `/admin/auditoria` y un detalle de comercio: debe pedir login sin mostrar información.
3. Con un usuario común, repetir: debe volver a Home. Desde su consola, llamar a `admin_read` o `admin_set_resource_status` usando su cliente/sesión: debe negar el acceso. No utilizar una clave service role para esta comprobación.
4. Con ADMIN, revisar el resumen y los listados. Buscar por nombre, filtrar activos/inactivos/bloqueados, probar la segunda página si hay más de 25 registros. Abrir un detalle de comercio.
5. Elegir un comercio de prueba activo. Abrir Suspender y cancelar: no debe cambiar. Reabrir, elegir motivo y nota, confirmar.
6. En una ventana sin sesión, recargar Home/búsqueda y abrir su tienda y un producto: no deben mostrarse. Verificar que los pedidos históricos permanecen. Como propietario, ver el aviso de suspensión.
7. Reactivar desde ADMIN y comprobar que la tienda y sus productos previamente activos vuelven a verse. La URL debe seguir igual.
8. Bloquear un producto activo con motivo. Verificar que no aparece públicamente y que su dueño ve el aviso, con reactivación deshabilitada en listado y edición. Comprobar que la cantidad de stock no cambió.
9. Como dueño, intentar `manage_my_product` con `p_action: 'activate'` o un UPDATE directo de `active = true` para ese producto: debe fallar mientras esté bloqueado. Probar también guardar con `active = true`; confirmar stock sin reactivar debe seguir permitido.
10. Desbloquear como ADMIN: el producto antes activo vuelve a su estado previo. Repetir sobre uno que su dueño ya tenía inactivo: debe seguir inactivo luego de retirar el bloqueo.
11. Revisar Auditoría: administrador, acción, entidad, fecha, motivo y nota de cada cambio. Probar paginación cuando haya más de 25 acciones. No hay botones para borrar/editar registros.
12. Revocar el permiso desde SQL Editor y recargar el panel: no debe permitir acceso ni acciones administrativas.

No se ejecutaron tests, build, navegador, E2E, lint ni SQL remoto durante la implementación. Las verificaciones anteriores las debe realizar el operador después de aplicar el delta.

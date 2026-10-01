# Pedido Abierto real

> Guía de la etapa de pedidos. Radar y ofertas se conectaron después: ver [RADAR_OFFERS_SETUP.md](RADAR_OFFERS_SETUP.md). Las referencias de esta guía a ofertas/Radar locales describen el estado anterior.

## SQL requerido

Ejecutá manualmente **todo `supabase/request-rls.sql`** en Supabase → SQL Editor → New query. Requiere el esquema, Auth y perfiles existentes. No vuelvas a ejecutar `schema.sql`, el seed ni migraciones anteriores.

El SQL reafirma las políticas de propietario de `requests`: SELECT sólo del comprador, INSERT con `buyer_id = auth.uid()` y estado OPEN, UPDATE sólo de un pedido propio OPEN y vigente, con destino CLOSED o CANCELLED. Se conservan los permisos de actualización limitados a `status`. No se agrega lectura pública ni acceso especial para comerciantes, ni se modifica Offers o Radar.

Agrega `create_my_request`, una función `SECURITY INVOKER`, con `search_path` fijo y ejecución sólo para usuarios autenticados. Valida título, descripción, categoría real, radio y urgencia. El `buyer_id` proviene de `auth.uid()`; no existe parámetro de propietario. Los valores de ubicación y foto quedan NULL, y status/created_at usan OPEN y la hora de PostgreSQL.

Cada formulario genera un UUID de envío que se reutiliza en sus reintentos. La función serializa envíos de la cuenta y devuelve el pedido propio existente si ese UUID ya se publicó. Esto evita duplicar un pedido por doble submit o pérdida de respuesta al reintentar en el mismo formulario. No se deduplican pedidos distintos con igual título ni se importa localStorage.

## Vencimiento

| Selección | Enum existente | Plazo desde la creación |
| --- | --- | --- |
| Lo necesito hoy | TODAY | 24 horas |
| Mañana | TOMORROW | 48 horas |
| Esta semana | THIS_WEEK | 7 días |
| No tengo apuro | FLEXIBLE | 14 días |

`FLEXIBLE` es el valor que ya usa la base para el concepto NO_RUSH; no se cambia el enum. Las fechas se calculan en PostgreSQL. Un pedido OPEN cuyo `expires_at` ya pasó se muestra como Expirado sin escribir EXPIRED en la fila. Los CLOSED/CANCELLED conservan su estado aunque pase su vencimiento.

No hay cron ni proceso en segundo plano. Mientras la pantalla está abierta, un reloj visual y una lectura al próximo vencimiento visible mantienen el estado; las consultas también se refrescan al recuperar foco. No hay Realtime ni notificaciones.

## Pantallas y separación de datos

- `/pedido/nuevo`: mismo formulario y estilo, con categorías reales y validaciones. Está protegido por login y conserva `?q=` después del login.
- `/pedidos`: sólo pedidos del comprador autenticado, 20 por página; filtros Todos, Abiertos, Cerrados, Cancelados y Expirados.
- `/pedido/[uuid]`: detalle privado con categoría, descripción, radio, urgencia, creación, vencimiento y estado. Cerrar/Cancelar están disponibles sólo mientras siga abierto y vigente.
- `/pedido/[uuid]/confirmacion`: comprueba también el propietario y muestra el pedido persistido. No afirma que comercios recibieron notificaciones ni que pueden ofertar todavía.
- El detalle real muestra **Todavía no hay ofertas.** No consulta ni combina ofertas locales o remotas.
- Los pedidos anteriores de localStorage no aparecen en Mis pedidos reales. No se copian, borran ni escriben en ambas fuentes.
- El código local sigue existiendo para Radar/ofertas/reservas. Sus enlaces de retorno apuntan al detalle explícito `/demo/pedido/[id]`, sin fallback desde los UUID reales. El Radar sigue mostrando ejemplos locales y no recibe pedidos nuevos de Supabase.
- El shell de pedidos reales no inicia el almacenamiento local para cargar pedidos ni ejemplos.

## Prueba manual exacta

No se ejecutaron pruebas automáticas, suites, build, lint, typecheck, navegador ni SQL remoto durante esta implementación.

1. Ejecutá `request-rls.sql` y esperá que termine sin errores.
2. Sin sesión, buscá en Home una frase inexistente, por ejemplo **Sensor cigüeñal Ford Ka 2019 zzz987**. Pulsá **📢 Pedirlo a comercios cercanos**. Debe llevarte a login con un destino que conserve `/pedido/nuevo?q=...`.
3. Iniciá sesión con la cuenta **A**. Debe volver al formulario con ese título precargado. Elegí una categoría real, radio 5 km y Lo necesito hoy. Agregá una descripción y publicá.
4. Mientras se envía, debe mostrar **Publicando pedido...** y deshabilitar los controles. Al terminar debe abrir la confirmación con UUID real, datos y expiración. No debe prometer ofertas o notificaciones ya enviadas.
5. En Supabase → Table Editor → `requests`, buscá ese UUID. Verificá `buyer_id` igual al UUID de A (Authentication → Users), `category_id` real, `status = OPEN`, los campos escritos, `latitude/longitude/image_url = NULL`, `created_at` reciente y `expires_at` unas 24 horas después. Los horarios del Dashboard pueden estar en UTC; la interfaz usa la zona del navegador.
6. Abrí `/pedidos`, recargá y volvé a iniciar sesión como A si querés comprobar otra sesión. El pedido debe mantenerse sin depender de localStorage. Abrí su detalle y comprobá que no muestra ofertas demo.
7. En el detalle, pulsá **Cerrar pedido** y confirmá. Verificá CLOSED en Supabase. Recargá: debe permanecer cerrado, aparecer en Cerrados y no ofrecer acciones para reabrir/cancelar.
8. Creá un segundo pedido. Pulsá **Cancelar pedido** y confirmá. Verificá CANCELLED, persistencia al recargar y presencia en Cancelados.
9. Creá un tercer pedido y dejalo OPEN. Copiá su URL/UUID para probar permisos sin confundir una denegación por propietario con una por estado finalizado.
10. Cerrá sesión e iniciá sesión con **B**. Mis pedidos debe mostrar sólo los de B o una lista vacía. Pegá la URL del pedido OPEN de A y también su URL de confirmación: ambas deben mostrar **Este pedido no está disponible.**. No debe haber botones para modificarlo.
11. Volvé a A y comprobá que el tercer pedido sigue OPEN y no fue modificado. Abrí Radar: debe continuar con ejemplos locales y no con ese pedido real.
12. Para probar vencimientos sin esperar, usá un pedido adicional de prueba y, como administrador en Table Editor, poné `created_at` dos días atrás y `expires_at` un día atrás, conservando OPEN. Cumplí siempre `expires_at > created_at`. En la web debe verse Expirado, sin acciones; en PostgreSQL debe seguir OPEN. Los pedidos ya cerrados/cancelados no deben cambiar de etiqueta.

## Comprobar RLS con otra cuenta

Con el tercer pedido de A todavía OPEN, obtené el UUID de B y reemplazá ambos marcadores. Ejecutá manualmente este bloque completo en SQL Editor:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"UUID_USUARIO_B","role":"authenticated"}', true);

-- Cada consulta debe devolver CERO filas.
select * from public.requests where id = 'UUID_PEDIDO_OPEN_DE_A'::uuid;
update public.requests set status = 'CLOSED'
  where id = 'UUID_PEDIDO_OPEN_DE_A'::uuid returning id;
update public.requests set status = 'CANCELLED'
  where id = 'UUID_PEDIDO_OPEN_DE_A'::uuid returning id;

rollback;
```

Si aparece un error inesperado, ejecutá `rollback;` antes de continuar. No uses una consulta administrativa sin `set local role authenticated` para comprobar los permisos de B: el administrador puede omitir RLS. No necesitás compartir contraseñas ni tokens.

## Archivos creados

- `supabase/request-rls.sql`
- `src/lib/buyer-requests.ts`
- `src/components/requests/buyer-request-data.tsx`
- `src/components/requests/buyer-request-common.tsx`
- `src/components/requests/buyer-requests.tsx`
- `src/app/demo/pedido/[id]/page.tsx`
- `REQUEST_SETUP.md`

## Archivos modificados

- `src/types/database.ts`: contrato de create_my_request; reutiliza RequestRow y enums existentes.
- `src/components/requests/new-request.tsx`: formulario real, categorías y publicación idempotente.
- `src/components/requests/request-shell.tsx`: distingue pedidos reales de módulos demo sin iniciar localStorage en las nuevas pantallas.
- `src/app/pedidos/page.tsx`
- `src/app/pedido/nuevo/page.tsx`
- `src/app/pedido/[id]/page.tsx`
- `src/app/pedido/[id]/confirmacion/page.tsx`
- `src/proxy.ts`: protege listado, creación, detalle y confirmación.
- `src/components/requests/offer-detail.tsx` y `offer-confirmation.tsx`: únicamente los enlaces de vuelta al detalle demo.
- `src/components/radar/radar.tsx`: comentario y texto/enlace de separación, sin migrar consultas ni acciones.
- `src/components/auth/account.tsx` y `src/components/home/home-dialogs.tsx`: textos acordes con la persistencia real de pedidos.
- `src/app/workflows.css`: permite ajustar UUID largos sin desbordar.
- `README.md`: referencia y estado actual de Pedido Abierto.


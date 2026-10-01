# Radar y ofertas reales

> Esta guía describe la etapa anterior. Para actualizaciones en vivo, instalar únicamente el nuevo SQL siguiendo [REALTIME_SETUP.md](REALTIME_SETUP.md); no repetir radar-offer-rls.sql.

Implementación de esta etapa: Radar y ofertas usan Supabase; reservas continúa local. No se ejecutó SQL remoto, navegador, build, lint, typecheck, suites ni pruebas automáticas. La integración queda pendiente de instalar el SQL y de tu prueba manual.

## SQL que tenés que ejecutar

Archivo: `supabase/radar-offer-rls.sql`.

Se parte del proyecto existente con `schema.sql`, Auth/perfiles, `business-rls.sql`, productos y `request-rls.sql` ya instalados. No vuelvas a ejecutar el esquema inicial ni los seeds.

1. Abrí tu proyecto en Supabase → SQL Editor → New query.
2. Copiá y ejecutá **sólo el primer bloque**, desde el primer `begin;` hasta su `commit;`. Agrega PENDING al enum de ofertas.
3. Esperá el resultado satisfactorio. En otra consulta, copiá y ejecutá **todo el segundo bloque**, desde el segundo `begin;` hasta el último `commit;`. La separación permite usar el nuevo valor del enum una vez confirmado.
4. Recargá CercaYa. Sin este SQL, el Radar y las ofertas muestran un error de carga; no recurren a mocks como reemplazo.

El segundo bloque convierte ofertas ACTIVE que ya existan en la base a PENDING; no toca localStorage ni importa datos. Conserva ACTIVE/EXPIRED en el enum por compatibilidad. Reemplaza la restricción única histórica por un índice único para PENDING/ACCEPTED: tras retirar una oferta puede enviarse otra al mismo pedido si sigue OPEN y vigente. Las filas retiradas permanecen en el historial.

## Acceso y RLS

| Recurso | Acceso permitido |
| --- | --- |
| `requests` directo | Conserva la lectura exclusiva del comprador dueño. No se agrega lectura comercial ni anónima. |
| `read_radar` | Sólo cuenta con comercio propio activo. Devuelve ID del pedido, título, descripción, categoría, urgencia, radio, fechas, contador y el ID de su propia oferta activa. Sólo OPEN no vencidos. |
| `offers` SELECT | Sólo comprador dueño del pedido o propietario del comercio que ofertó. Otros usuarios y anónimos no pueden leerlas. |
| `read_offers` comprador | Exige dueño del pedido; permite detalle por request + offer. Devuelve sólo los campos de oferta y nombre, ciudad, WhatsApp del comercio. |
| `read_offers` vendedor | Exige dueño del comercio de esa oferta. No muestra ofertas de otros comercios. |
| `create_my_offer` | Deriva business_id de auth.uid(), exige comercio activo y pedido OPEN vigente, valida campos y producto opcional del mismo comercio con stock. Crea PENDING. |
| `withdraw_my_offer` | Sólo dueño de la oferta: PENDING → WITHDRAWN. Admite reintento y retiro incluso si el pedido cerró o venció o el comercio se desactivó. |

Las RPC usan SECURITY DEFINER con search_path fijo y controles explícitos de auth.uid(). La de Radar es una proyección limitada porque conceder SELECT sobre requests también expondría buyer_id y coordenadas. No devuelve esos campos, teléfono, nombre ni dirección del comprador. El título y la descripción son el texto publicado por el comprador.

Se revocan las escrituras directas a offers, incluidos los permisos por columna del esquema inicial. Sólo las RPC autorizadas escriben. No hay parámetros de owner_id/business_id confiados al formulario, actualización arbitraria de estado, DELETE, aceptación ni reserva. La proyección del comercio en las ofertas excluye owner_id y datos del perfil del propietario; no se cambian las políticas de otras tablas.

El envío bloquea el pedido y revalida su vigencia con hora de PostgreSQL. El índice único y el retorno de la oferta activa existente evitan duplicados entre pestañas o ante reintentos. El formulario también bloquea doble submit. No se descuenta stock al enviar.

## Comportamiento

- Radar prioriza business_categories. Dentro de esas prioridades ordena por recientes o urgencia. Filtros: Todos, Necesita hoy y Coincide con mi catálogo.
- Matching determinista por palabras de título/descripción contra nombre, marca y modelo del producto; la categoría suma prioridad. Se exige al menos una palabra coincidente. Sólo sugiere productos activos con cantidad positiva, estado distinto de OUT_OF_STOCK y una modalidad habilitada tanto en producto como en comercio.
- El radio se muestra como “Busca dentro de 20 km”. No se filtra por geografía ni se inventan distancias. La demanda agrupa categorías de pedidos OPEN y aclara que no está limitada geográficamente.
- Las lecturas del Radar, catálogo y ofertas recorren páginas de 100 registros. Métricas y demanda usan todos los resultados cargados, no solamente las cards visibles por filtro.
- Los contadores representan **ofertas recibidas históricas**, incluidas retiradas. No se guarda offersCount en requests. Mis pedidos usa la relación `offers(count)`; el Radar usa COUNT en la base. “Sin ofertas” significa que nunca recibió ninguna.
- El comprador ve también ofertas retiradas con su estado. WhatsApp se habilita en el detalle de ofertas PENDING con teléfono válido; prepara un mensaje y no lo envía automáticamente.
- Actualizar, recargar, volver a entrar o recuperar foco relee datos. El reloj de pantalla oculta vencidos sin escribir EXPIRED. No hay Realtime ni notificaciones.
- Las nuevas rutas no usan el store de pedidos/ofertas locales. La ruta explícita `/demo/pedido/[id]/oferta/[offerId]` conserva las reservas de prueba anteriores; sólo se ajustaron sus enlaces, no la lógica de reservas.

## Tu prueba manual, paso a paso

Usá siempre el mismo origen, por ejemplo `http://127.0.0.1:3000`. Para mantener sesiones distintas, usá perfiles distintos del navegador, otra ventana privada o dispositivos diferentes. Prepará tres cuentas: A comprador, B comercio, C tercero.

1. **B / Preparar catálogo:** iniciá sesión, abrí `/comercio/mi-negocio` y comprobá un comercio activo con categoría Ferretería (o la categoría real que uses), ciudad y WhatsApp con código de país/área. Habilitá retiro; si querés probar envío, habilitalo también y guardá un costo.
2. En `/comercio/productos`, creá o editá un producto activo “Térmica Schneider bipolar 25A”, marca Schneider, modelo 25A, precio 12500, stock 3 y retiro disponible. Usá la misma categoría. Si tiene envío, habilitalo también en el producto.
3. **A / Crear pedido:** iniciá sesión, abrí `/pedido/nuevo`, título “Térmica bipolar 25A”, misma categoría, urgencia Hoy, radio 20 km. Publicá y copiá la URL `/pedido/UUID`. Dejalo OPEN; no lo cierres ni canceles.
4. **B / Radar:** abrí `/comercio/radar` y pulsá Actualizar. Debe aparecer el pedido con “Busca dentro de 20 km”, sin distancia calculada ni datos privados del comprador. Probá Todos, Necesita hoy y Coincide con mi catálogo; verificá las métricas y la categoría en la demanda.
5. Debe aparecer el producto sugerido con precio y stock 3. Pulsá **Enviar esta oferta**. El formulario debe precargar producto, descripción, precio y modalidades. Completá una descripción de al menos 3 caracteres y, si hay envío, costo y tiempo estimado. Enviá una vez; debe abrir `/comercio/oferta-enviada/UUID` con estado Pendiente. Copiá esa URL.
6. **A / Recibir:** recargá `/pedidos`: debe decir “1 oferta recibida” para ese pedido. Abrí el pedido y pulsá Actualizar en Ofertas recibidas. Revisá producto, precio, descripción, comercio, ciudad, WhatsApp, modalidades, costo, estimado, fecha y alternativa si la marcaste.
7. Abrí **Ver oferta**, copiá su URL y pulsá **Hablar por WhatsApp**. Debe abrir el número del comercio con “Hola, recibí tu oferta por Térmica Schneider bipolar 25A en CercaYa.” No hace falta enviar el mensaje. No debe haber botón para aceptar/reservar.
8. **B / Duplicado:** volvé al Radar y actualizá. Debe decir “✅ Ya enviaste una oferta” y mostrar Ver mi oferta. Si volvés a la URL del formulario, debe mostrar el mismo aviso. Si abriste dos formularios antes del primer envío, enviar el segundo debe recuperar la misma oferta; A sigue viendo una sola fila.
9. **B / Retiro:** desde Ver mi oferta pulsá **Retirar oferta**. Debe cambiar a Retirada. No debe eliminarse la fila ni quedar disponible el botón de retiro. **A** actualiza el pedido y también ve Retirada; el contador histórico sigue en 1.
10. **C / Aislamiento:** iniciá sesión con la tercera cuenta y pegá tanto la URL de detalle de A como la URL de oferta del vendedor B. Ambas deben mostrar “Esta oferta no está disponible para tu cuenta.” Pegá el pedido de A: debe decir que no está disponible. Sin sesión esas rutas deben redirigir al login. No basta consultar con SQL Editor administrativo para comprobar RLS: usa un rol privilegiado.
11. **Privacidad de la respuesta:** opcionalmente, en Herramientas de desarrollador → Network, inspeccioná la respuesta `read_radar` de B y `read_offers` de A. El Radar no debe incluir buyer_id ni coordenadas; las ofertas no deben incluir owner_id ni perfiles del propietario. Una cuenta sin comercio no puede obtener el Radar.
12. **Cierre:** antes de cerrar el pedido con A, dejá un formulario manual abierto con B. A cierra el pedido; B intenta enviar: debe recibir “Este pedido ya no acepta ofertas.” Al actualizar Radar ya no aparece. Para Cancelado repetí con otro pedido. Un pedido que supere expires_at debe desaparecer y rechazar envíos del mismo modo, sin necesidad de escribir EXPIRED.
13. **Oferta manual:** publicá otro pedido OPEN con A sin coincidencia en el catálogo. B usa Tengo este producto, completa los campos y envía. En la tabla offers debe quedar product_id NULL y business_id del comercio B. A debe verla tras Actualizar.

## Archivos de esta etapa

### Creados

- `supabase/radar-offer-rls.sql`: permisos, proyecciones, envío y retiro atómicos.
- `src/lib/real-radar.ts`: consultas reales, matching y orden.
- `src/lib/real-offers.ts`: consultas, validaciones, estados y WhatsApp.
- `src/components/requests/use-account-data.ts`: carga y refresco en memoria por cuenta.
- `src/components/requests/real-offer-form.tsx`: formulario real del vendedor.
- `src/components/requests/real-offers.tsx`: lista del comprador y detalles de ambas partes.
- `src/app/demo/pedido/[id]/oferta/[offerId]/page.tsx`: ruta explícita de la oferta demo anterior.
- `RADAR_OFFERS_SETUP.md`: esta guía.

### Modificados

- `src/types/database.ts`: PENDING y contratos tipados de RPC/proyecciones.
- `src/lib/buyer-requests.ts`: agregación del contador real de ofertas.
- `src/components/radar/radar.tsx`: Radar real y métricas.
- `src/components/radar/opportunity-card.tsx`: oportunidad y producto reales, sin distancias simuladas.
- `src/components/radar/merchant-workspace.tsx`: accesos y textos de la etapa real.
- `src/components/requests/buyer-requests.tsx`: ofertas y contador del comprador.
- `src/components/requests/new-request.tsx`: aviso de recepción de ofertas.
- `src/components/requests/request-shell.tsx`: aviso de persistencia y separación de la demo.
- `src/components/requests/offer-card.tsx`, `offer-detail.tsx`, `request-detail.tsx`: enlaces explícitos a la demo anterior, sin cambios a reservas.
- `src/components/home/home-dialogs.tsx`: explicación del flujo vigente.
- `src/app/comercio/page.tsx`: shell de datos reales.
- `src/app/comercio/radar/page.tsx`: sesión obligatoria.
- `src/app/comercio/oportunidades/page.tsx`: redirección al Radar autenticado.
- `src/app/comercio/oportunidades/[id]/responder/page.tsx`: formulario real protegido, sin business_id de la URL.
- `src/app/comercio/oferta-enviada/[id]/page.tsx`: detalle privado del vendedor.
- `src/app/pedido/[id]/oferta/[offerId]/page.tsx`: detalle privado del comprador.
- `src/proxy.ts`: protección de las rutas reales de Radar/ofertas.
- `README.md`: estado y rutas actuales.
- `REQUEST_SETUP.md`: enlace a esta etapa posterior.

### Eliminados

- `src/components/requests/offer-form.tsx` y `src/components/requests/offer-confirmation.tsx`: envío y confirmación locales sin rutas consumidoras, reemplazados por los componentes reales. Se conservan el detalle y las cards demo necesarios para las reservas anteriores.

No se modificaron el store, dominio, tablas ni flujos de reservas. No se instalaron dependencias nuevas.


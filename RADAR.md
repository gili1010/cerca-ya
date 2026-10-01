# Radar CercaYa

Implementación local del Radar sobre los mismos pedidos, ofertas, productos e inventario existentes. Conserva el diseño y la lógica de reservas. No usa Supabase, IA, mapas, ubicación real, pagos ni comunicaciones externas.

## Archivos creados

- `src/app/comercio/page.tsx`: panel con accesos del comercio.
- `src/app/comercio/productos/page.tsx`: catálogo del comercio seleccionado.
- `src/app/comercio/radar/page.tsx`: nueva entrada al Radar.
- `src/components/radar/business-selector.tsx`: selector de comercio y sus categorías.
- `src/components/radar/merchant-workspace.tsx`: panel y catálogo, reutilizando las cards existentes.
- `src/components/radar/radar.tsx`: resumen, filtros, orden y demanda local.
- `src/components/radar/opportunity-card.tsx`: oportunidad, coincidencia sugerida y acceso a la oferta.
- `src/data/radar-requests.ts`: seis pedidos de ejemplo y carga inicial compatible con datos anteriores.
- `src/lib/radar.ts`: coincidencias léxicas, filtros, prioridad, métricas y agrupación de demanda.
- `src/lib/request-availability.ts`: adaptación de distancias simuladas y vigencia de los pedidos.
- `RADAR.md`: esta documentación.

## Archivos modificados

- `src/types/requests.ts`: categorías adicionales, distancia aproximada y vencimiento opcionales, categorías y catálogo del comercio, origen opcional de ofertas y versión de datos demo del Radar.
- `src/data/businesses.ts`: conecta los comercios del catálogo publicado con Pedido Abierto y declara sus categorías.
- `src/lib/products.ts`: agrega tres productos publicados simulados: térmica, mecha y cargador.
- `src/lib/request-domain.ts`: comprueba radio y vigencia, bloquea una segunda oferta del mismo comercio al mismo pedido, valida producto sugerido y preserva nuevos campos al restaurar datos.
- `src/lib/request-store.ts`: incorpora los pedidos demo una sola vez y serializa envíos de ofertas mediante Web Locks cuando el navegador los ofrece. Reutiliza la misma persistencia y sincronización entre pestañas.
- `src/components/demo-provider.tsx`: mantiene el comercio seleccionado durante la navegación de esta sesión.
- `src/components/requests/opportunities.tsx`: reutiliza Radar para la entrada anterior de oportunidades.
- `src/app/comercio/oportunidades/page.tsx`: título Radar CercaYa.
- `src/app/comercio/oportunidades/[id]/responder/page.tsx`: recibe el producto sugerido para precargar la oferta.
- `src/components/requests/offer-form.tsx`: precarga catálogo, admite edición manual, valida disponibilidad y muestra la oferta existente en lugar de permitir un duplicado.
- `src/components/requests/offer-confirmation.tsx`: regreso al Radar.
- `src/components/requests/request-shell.tsx`: navegación Panel, Productos, Radar, Reservas y Estadísticas — Próximamente.
- `src/components/home/header.tsx`: entrada al panel del comercio.
- `src/components/home/home-dialogs.tsx`: entrada al panel desde Cuenta.
- `src/app/workflows.css`: estilos mínimos para las nuevas secciones, reutilizando la paleta y las cards actuales.

## Comportamiento

El Radar lee exclusivamente pedidos OPEN dentro del radio permitido por el comprador. Si un pedido tiene `expiresAt`, deja de mostrarse después de esa fecha. Los cierres y cancelaciones se reflejan mediante el store existente; el reloj de la vista actualiza vencimientos cada minuto y al volver a la pestaña.

Los datos demo nuevos se agregan una sola vez en `cercaya.pedidos.v1`, con IDs posteriores al máximo existente y la marca `radarSeedVersion: 1`. No se borran ni reemplazan pedidos, ofertas o reservas previos. Los seis pedidos de Radar tienen vencimiento de siete días. No se regeneran al recargar. Se pueden crear otros desde Pedido Abierto.

El selector incluye comercios con catálogo publicado, como Ferretería Norte y Punto Tech, y los comercios anteriores sin catálogo. Ferretería Norte vende Ferretería, Electricidad, Herramientas y Pintura. Las distancias nuevas pertenecen a un escenario simulado común; para pedidos anteriores se conserva la distancia demo del comercio. No se calculan ubicaciones reales.

La coincidencia usa palabras del nombre normalizadas, elimina términos frecuentes y da un pequeño peso adicional a categorías relacionadas. Compartir una categoría sin palabras del producto no genera una sugerencia. Es una posible coincidencia, no una garantía de compatibilidad. El stock se consulta en el inventario local existente; ofrecer un producto no descuenta unidades.

Los filtros son excluyentes: Todos, Necesita hoy, Menos de 5 km, Menos de 10 km y Coincide con mi catálogo. Más recientes y Más cerca priorizan primero las categorías del comercio y luego ordenan cada grupo. Urgentes coloca primero Hoy, luego Mañana, Esta semana y Sin apuro. Se usan los valores de urgencia que ya tenía Pedido Abierto.

El resumen y la demanda por categoría cuentan todos los pedidos activos de la zona, independientemente del filtro seleccionado. Se destacan los pedidos para hoy a menos de cinco kilómetros con cero o una oferta.

Las cards solo reciben los campos públicos necesarios del pedido. No muestran identidad, teléfono, dirección, coordenadas ni la descripción libre del comprador.

Se admite una oferta por comercio y pedido. La protección existe en la card, al entrar al formulario y en la operación de guardado, que relee el almacenamiento. Los envíos concurrentes se serializan con Web Locks en navegadores compatibles. Ofertas duplicadas anteriores se conservan, pero no se pueden agregar otras para ese par.

## Pasos manuales exactos

Usá ambas pestañas en el mismo navegador y con `http://127.0.0.1:3000`. No alternes con `localhost`, que usa otro almacenamiento.

1. Abrí `http://127.0.0.1:3000/comercio`. Elegí **Ferretería Norte** en **Comercio de prueba**.
2. Tocá **📡 Radar**. Debe abrir `/comercio/radar` y mostrar pedidos, distancias aproximadas, métricas y categorías del comercio.
3. Buscá **Térmica bipolar 25A** de categoría Electricidad, a **2,1 km**. También deberían aparecer el taladro, la mecha, el cargador y el aceite, salvo que ya se hayan cerrado o vencido. Los pedidos previos del navegador siguen presentes cuando están abiertos y dentro del radio.
4. Tocá **Necesita hoy**. Deben quedar solo pedidos para hoy. Probá también Menos de 5 km, Menos de 10 km y los tres órdenes. El resumen superior conserva las métricas de toda la zona.
5. Tocá **Coincide con mi catálogo**. En el pedido de la térmica debe aparecer **Térmica Schneider bipolar 25A**, $12.500, stock inicial 3. Ese stock puede ser menor si ya reservaste unidades en una sesión anterior.
6. Tocá **Enviar esta oferta**. El formulario debe traer producto, precio, descripción, retiro, envío, tiempo estimado y comercio. El encabezado identifica el pedido. Anotá su ID y copiá la URL del formulario para el paso 9. Revisá y tocá **Enviar oferta**.
7. Abrí otra pestaña en `http://127.0.0.1:3000/pedidos`, como comprador. Abrí el pedido con el ID anotado. Alternativamente, usá el enlace **Ver pedido como comprador** del comprobante, abriéndolo en otra pestaña.
8. Comprobá que llegó la oferta de Ferretería Norte con el producto y precio enviados, y que aumentó el contador de ofertas. Recargá para comprobar persistencia.
9. Volvé al Radar con Ferretería Norte. Esa oportunidad debe mostrar **Ya enviaste una oferta** y **Ver mi oferta**, sin botones para repetir el envío. Pegá también la URL del formulario copiada en el paso 6: debe mostrar la oferta existente y no un formulario nuevo. Para comprobar dos pestañas antiguas, podés abrir el formulario de otro pedido en ambas antes de enviar; el segundo envío debe quedar bloqueado.
10. Para la respuesta manual, elegí **Mi comercio de prueba**, que no tiene catálogo publicado. Tocá **Tengo este producto**, completá precio y descripción, elegí retiro o envío y enviá. Debe llegar al mismo Pedido Abierto.
11. Desde el comprador, cerrá o cancelá un pedido que esté visible en Radar. Debe desaparecer del Radar de la otra pestaña y actualizar las métricas y la demanda.

No se ejecutaron pruebas automáticas, suites, build, lint, navegador ni verificaciones visuales para esta etapa, siguiendo la indicación del usuario.

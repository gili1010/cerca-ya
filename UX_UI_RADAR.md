# CercaYa — UX/UI 7: Radar comercial, servicios y propuestas

## Estado y recuperación del trabajo

Se retomó el working tree existente mediante git status, git diff y lectura de componentes. Ya estaban implementadas la nueva presentación de ambos Radar, los contextos de solicitudes, los presupuestos, vistas previas, comparación y diálogos. Se conservaron esos cambios y los avances previos de UX/UI 4, 5 y 6. No se rehízo el rediseño.

Pendientes cerrados en la continuación:
- Crear este documento, con mapa real de pantallas, diferencias funcionales, archivos y QA manual.
- Cambiar el vencimiento comercial de Podés responder hasta por El pedido vence el: una tarjeta con oferta propia no debe sugerir que puede enviarse otra.
- Agregar preventCancel al diálogo de retiro comercial: Escape utiliza el cierre controlado existente y no cierra nativamente el diálogo mientras busy impide abandonarlo. No se cambia la RPC ni el handler de retiro.

Revisión exclusivamente por lectura. No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni despliegues. No se instalaron dependencias. No se afirma PASS de compilación, funcionamiento, concurrencia, accesibilidad o responsive en ejecución. UX/UI 8 no se inició.

## Auditoría y documentación consultada

Referencias: UX_UI_GUIDELINES, UX_UI_HOME, UX_UI_SEARCH, UX_UI_DETAILS, UX_UI_PUBLISH, UX_UI_ACTIVITY_ACCOUNT, SERVICE_RADAR_SETUP y SERVICE_RADAR_FRONTEND. Se revisaron los helpers/contratos de real-radar, real-offers, service-radar/client, service-radar/contracts, service-radar/navigation y los DTO de ambos dominios. La guía instalada de Next.js sobre Server/Client Components se conserva como referencia para los límites de componentes.

| Contexto real | Rutas y componentes | Hallazgo / presentación |
| --- | --- | --- |
| Necesito un producto | /pedidos, /pedido/[id], BuyerRequestList/Detail | Distinguir solicitud de producto de una reserva; orientar hacia ofertas recibidas. |
| Puedo ofrecer un producto | /comercio/radar, OpportunityCard, /comercio/oportunidades/[id]/responder, RealOfferForm | Explicar qué buscan, distancia aproximada, coincidencia y respuesta propia, sin inventar bandeja. |
| Oferta comercial guardada | /comercio/oferta-enviada/[id], RealOfferDetail | Acceso existente desde my_offer_id, importe/entrega y retiro con confirmación. |
| Oferta comercial recibida | /pedido/[id]/oferta/[offerId], BuyerOfferList/RealOfferDetail | Comparar información real y consultar contacto público permitido. No se acepta ni reserva desde una acción inventada. |
| Necesito un trabajo | /mis-solicitudes-servicio, /solicitud-servicio/[id], MyServiceRequests/BuyerServiceRequest | Separar descripción, vigencia y comparación de propuestas. |
| Puedo realizar un trabajo | /radar-servicios, /radar-servicios/[id], ServiceRadarList/ServiceOpportunity | Especialidad y cobertura declarada; nunca kilómetros ni domicilio particular. |
| Presupuesto profesional enviado | /mis-propuestas-servicio, /mis-propuestas-servicio/[id], ProposalEditor/MyServiceProposal | Mensaje, modalidad, importe, estado e historial sin confundir elección con trabajo finalizado. |

No se crean rutas, un segundo centro de Actividad ni componentes funcionales alternativos. Header/MobileNav/ActivityMenu y los shells existentes siguen dando acceso y regreso; los enlaces de detalle conservan los helpers de returnTo y parámetros actuales.

## Diferencias entre dominios

Comercial conserva read_radar, coincidencia por palabras/categoría, autorización por radio en PostgreSQL, Haversine, productos y opciones de entrega/retiro. Sus ofertas no se convierten en reservas por este rediseño. La UI no reutiliza cobertura profesional para filtrar comercios.

Servicios conserva especialidad exacta, servicios publicados/elegibles que aceptan consultas, perfil activo, cobertura por localidad y provincia, suspensión/moderación y vigencia autorizadas por PostgreSQL. No utiliza residencia como cobertura, coordenadas ni distancias comerciales.

El circuito profesional dispone de elección transaccional de propuesta y revisión optimista; el comercial no recibe esas acciones por analogía. No se agregan pagos, turnos, contratos, mensajería, reseñas ni notificaciones.

## Radar comercial y respuestas

Encabezado Oportunidades de tu comercio y explicación concreta. Filtros de hoy/catálogo, distancia y orden conservan valores y handlers. Las métricas existentes salen de la lectura autorizada actual, antes de filtros; no se agregan contadores o consultas decorativas.

Tarjetas: qué busca el vecino, categoría, descripción, publicación, radio, distancia aproximada cuando existe, urgencia declarada, vencimiento y coincidencia de catálogo. El bloque de producto sugerido sigue aclarando que requiere revisar compatibilidad. Sin distancia se mantiene la advertencia; no se inventa localidad o cercanía.

my_offer_id sigue determinando Ya enviaste una oferta y Ver mi oferta. Los enlaces para ofrecer producto precargado o alternativa mantienen sus parámetros producto. El vencimiento se expresa como dato del pedido, sin afirmar permiso para enviar otra oferta.

RealOfferForm reutiliza los estilos de formularios UX/UI 5. Conserva campos, validaciones, bloqueo de envío, lectura autorizada y transición al detalle existente. El resumen desplegable muestra producto, descripción, importe, retiro/envío y tiempo informado; no confirma publicación ni crea reserva.

BuyerRequestList y detalle diferencian Mis pedidos de productos de reservas. Las ofertas recibidas usan una o dos columnas cómodas y mantienen contacto/disponibilidad de su DTO. Cerrar/cancelar pedido conserva sus escrituras y explica historial e imposibilidad de reabrir. Retirar oferta comercial incorpora un diálogo que invoca el mismo withdraw existente únicamente tras confirmar.

## Radar profesional y solicitudes propias

Título Trabajos que podés realizar, con Radar de servicios como contexto y explicación de cobertura. Revisar mi cobertura utiliza el ancla profesional existente. No se crean filtros nuevos: categoría exacta y página siguen siendo los actuales.

La preparación del perfil usa exclusivamente las lecturas ya existentes. Ausencia de perfil/cobertura/servicio habilitado conserva mensajes y enlaces a completar configuración. Un resultado sin oportunidades no se presenta como error. Actualizar vuelve a consultar mediante los handlers originales.

RequestCard distingue Oportunidad profesional de Tu solicitud de trabajo. Muestra título, especialidad, localidad/provincia, extracto de descripción, creación, vencimiento y estado comprensible. Sólo muestra Ya enviaste una propuesta si my_offer_id está presente. Los detalles mantienen el texto completo.

Se reutiliza requestIsOpen para representar disponibilidad actual. Si una fila OPEN ya pasó de fecha se presenta vencida; si dejó de estar disponible, no se anuncia que acepta propuestas. Es presentación: no materializa EXPIRED ni cambia estados, filtros o autorizaciones.

Mis solicitudes conserva consulta propia de 12 elementos/página, total, carga, errores y navegación. No se añade una consulta por tarjeta para contar propuestas: las respuestas se consultan en el detalle autorizado existente.

## Oportunidad, propuesta y recuperación

El detalle organiza contexto, título, especialidad, localidad, descripción y fechas en un bloque legible. Mantiene la privacidad del solicitante. Si existe propuesta propia ofrece Ver mi propuesta; sólo presenta formulario bajo las condiciones previas de disponibilidad.

ProposalEditor conserva servicio compatible propio, mensaje 10–1500, FIXED/FROM/QUOTE y precio cuando corresponde. Reutiliza publish-flow.module.css, ayudas vinculadas, foco del error y estados de envío/revisión. El nuevo resumen recibe título/localidad ya cargados por el padre; no consulta datos adicionales. Permite revisar servicio seleccionado, mensaje y presupuesto sin agregar un paso ni cambiar validaciones.

ProposalBudget es presentación compartida de modalidad, importe y explicación, usando servicePriceLabel existente:
- FIXED: importe para el trabajo descrito.
- FROM: Desde, aclarando que puede aumentar según el alcance.
- QUOTE: A presupuestar, sin importe inventado y con NULL en la mutación existente.

El resumen no presenta un importe inválido como presupuesto válido. El envío confirmado sigue navegando a Mis propuestas mediante la relectura existente, sin éxito optimista. Se conservan UUID, borrador por cuenta/solicitud, sessionStorage/memoria, revisión, candado, comprobación de sesión, prelectura, validación de oportunidad, reconsulta posterior, recuperación explícita e incertidumbre. Nunca se genera otro UUID automáticamente por error de red.

## Mis propuestas y comparación

Mis propuestas muestra trabajo, localidad, fecha, mensaje completo, modalidad/importe y estados legibles: Esperando respuesta, Tu propuesta fue elegida, No seleccionada y Propuesta retirada. El detalle mantiene edición/retiro únicamente bajo las condiciones existentes; las propuestas resueltas son de sólo lectura y no se reactivan.

Compará las propuestas recibidas utiliza tarjetas verticales en móvil y hasta dos columnas amplias en desktop. Cada una conserva nombre público, mensaje, modalidad/importe, disponibilidad actual, estado, acceso a perfil/servicio y acciones autorizadas. No hay orden nuevo por menor precio, recomendación, estrellas ni reputación ficticia. La selección se resume arriba y permanece también en su historial paginado: ambos bloques representan el mismo registro, no una propuesta adicional.

Elegir este profesional conserva canChoose, estado PENDING y disponibilidad. La confirmación identifica a quién se elige, trabajo y presupuesto. Advierte cierre de solicitud y rechazo de las demás pendientes. No implementa actualizaciones separadas: manage_my_service_request_offer sigue siendo la operación transaccional.

La reconciliación existente verifica revisión de propuesta, ACCEPTED, solicitud CLOSED y selected_offer_id correcto. No se muestra confirmación por el solo clic o por perderse una respuesta. Tras reconsulta, el bloque Elegiste a un profesional muestra la propuesta real y orientación para coordinar, sin afirmar contratación, agenda, pago o trabajo realizado.

## Contacto y privacidad

Contactar por WhatsApp sólo aparece para el seleccionado ACCEPTED, disponible y con contact_whatsapp autorizado no nulo según el DTO actual. Se conserva el helper argentino y apertura explícita del usuario. Si el contacto no está disponible se ofrece actualizar; no se busca otro número privado.

El profesional no ve propuestas competidoras, teléfono/email del vecino, domicilio exacto, coordenadas privadas ni datos administrativos. Se conservan DTO, queries y motivos reales de reportes. Reportar continúa como acción secundaria sin modificar moderación.

## Confirmaciones y EXPIRED

RadarConfirm conserva las operaciones y reconciliación de aceptar, rechazar, retirar, cerrar, cancelar y expire. La presentación agrega identificación del recurso, presupuesto cuando corresponde y diferenciación de la acción irreversible. Dialog mantiene foco nativo, cierre existente y protección durante busy; los errores y verificaciones siguen visibles.

Verificar resultado reconsulta; no repite automáticamente la mutación. EXPIRED es un estado efectivo que por sí solo no demuestra actualización física. Se conserva acknowledged y la condición original de reconciliación; una respuesta perdida o una relectura EXPIRED sin prueba suficiente mantiene el resultado indeterminado y exige revisión explícita. No se cambió ese contrato ni se agregó materialización automática.

## Responsive, accesibilidad y rendimiento

Estilos de servicios acotados mediante experience; comerciales mediante radar-experience.module.css. No se aplican a Home, productos o fotografías. Se mantienen tokens de CercaYa, verdes, tipografía de lectura, precios destacados, bordes y spacing existente. Contenido de hasta 1180 px con formularios de ancho cómodo.

Listas/comparación de una o dos columnas, nunca cuatro presupuestos comprimidos. Móvil apila acciones, permite mensajes completos y evita tablas horizontales. No se agrega otra barra sticky ni se modifica MobileNav/safe-area global. Los controles de filtros y los vínculos conservan sus acciones reales.

Foco visible, labels y ayudas, error anunciado/enfocable en propuestas, time/dl para fechas, estados con texto y LoadingState compartido. Los diálogos reutilizan Dialog y sus controles; no se crea otro sistema modal. No hay animaciones nuevas; rige la preferencia global de movimiento reducido.

No hay nuevas consultas por tarjeta, polling, suscripciones, dependencias ni cachés. Las páginas profesionales conservan paginación real y los parámetros page/category/offer_page/returnTo existentes. Comercial mantiene sus lecturas y actualizaciones actuales, sin simular una nueva paginación.

## Archivos de UX/UI 7

Creados en el trabajo retomado:
- src/components/radar/radar-experience.module.css
- src/components/service-radar/proposal-budget.tsx

Modificados en el trabajo retomado:
- src/components/radar/radar.tsx
- src/components/radar/opportunity-card.tsx
- src/components/requests/buyer-requests.tsx
- src/components/requests/real-offer-form.tsx
- src/components/requests/real-offers.tsx
- src/components/service-radar/radar-lists.tsx
- src/components/service-radar/radar-details.tsx
- src/components/service-radar/proposal-editor.tsx
- src/components/service-radar/radar-confirm.tsx
- src/components/service-radar/radar-common.tsx
- src/components/service-radar/service-radar.module.css

Esta continuación ajustó únicamente opportunity-card.tsx y real-offers.tsx, y creó UX_UI_RADAR.md. Los demás cambios se conservaron. request-editor.tsx y los archivos de UX/UI 4/5/6 que aparecen en git status pertenecen al trabajo previo: no se rehacen ni se atribuyen a UX/UI 7.

UX_UI_GUIDELINES.md no cambia en esta continuación: se utilizan sus reglas actuales, sin introducir otro sistema global. No se requiere SQL adicional.

## Limitaciones pendientes

- La revisión por lectura no prueba compilación, foco, responsive ni operación remota. Se requiere QA manual antes de publicar.
- No hay bandeja independiente de ofertas comerciales. Se conservan sólo los accesos reales a detalles de ofertas, sin inventar rutas o IDs.
- El circuito comercial conserva recuperación y unicidad existentes, diferentes del mecanismo de UUID/revisiones profesionales; no se los reemplaza ni se declara equivalencia.
- readRadarRequests/readRealOffers comerciales ya recorren páginas autorizadas hasta completar el conjunto y el Radar carga catálogo propio para coincidencias. No se agregaron descargas ni se reestructuró ese comportamiento en una etapa visual. Una mejora de paginación efectiva comercial necesita una etapa funcional separada.
- Una captura de disponibilidad no es garantía hasta la próxima revalidación del backend. El contacto conserva el refresh autorizado existente, sin una operación atómica adicional al hacer clic.
- Los detalles públicos enlazados conservan sus retornos actuales; no se amplió el helper general para aceptar nuevas rutas de retorno ni se añadieron parámetros no soportados.
- Las descripciones de oportunidades tienen extracto en listado y texto completo en detalle; no se recorta el mensaje de una propuesta enviada.

## Pruebas manuales pendientes

Usar exclusivamente cuentas y registros QA autorizados; no realizar pagos ni alterar datos reales innecesariamente.

1. Entrar desde Actividad a pedidos de productos, ambos Radar, solicitudes de servicios y propuestas. Verificar rutas reales y retorno a listados conservando page/category/offer_page y returnTo seguro.
2. Comercio: comparar filtros hoy/catálogo/distancia/orden, métricas reales y actualización. Sin coordenadas o distancia no debe inventar cercanía; no mezclar cobertura profesional.
3. Comercio: oportunidad con producto sugerido, sin producto y ya respondida. Vencimiento visible, Ver mi oferta con ID real y parámetros producto precargados intactos.
4. Oferta comercial QA: revisar formulario, opciones reales de retiro/envío, importe, alternativa y resumen. Enviar y consultar el detalle sin crear una reserva.
5. Retiro comercial: Volver y Escape no escriben; confirmar ejecuta la acción existente una vez. Durante busy no debe desaparecer el diálogo con Escape. Probar error de red y actualizar para comprobar resultado.
6. Comprador: pedidos abiertos/cerrados/cancelados/vencidos, ofertas recibidas, detalle, WhatsApp permitido y ausencia de contacto. Cerrar/cancelar con confirmación y comprobar historial.
7. Profesional sin perfil, sin cobertura o sin servicio elegible: revisar mensajes y enlaces actuales. Con perfil válido, probar especialidad exacta, paginación y vacío. No mostrar kilómetros.
8. Abrir una oportunidad: descripción completa, localidad, creación/vencimiento y propuesta propia cuando exista. No mostrar contactos privados ni propuestas ajenas.
9. Propuesta QA FIXED/FROM/QUOTE: ayudas, resumen, precio válido y NULL en QUOTE según contrato. Cambiar mensaje/servicio, volver y recuperar el mismo borrador, sin UUID nuevo por fallo de red.
10. Interrumpir red durante envío/edición: conservar formulario, Verificar estado, candado y relectura. Doble clic no debe duplicar; conflicto entre pestañas exige revisar la versión remota.
11. Mis propuestas: cuatro estados, historial, edición pendiente elegible, retiro terminal y solicitud vencida. Elegida no debe decir trabajo terminado ni pago realizado.
12. Solicitante: comparar propuestas con mensajes y modalidades diferentes, sin recomendación por precio. Elegir, volver y confirmar; comprobar selección única, cierre y rechazo transaccional de las otras pendientes.
13. Competencia entre pestañas o respuesta perdida al elegir: verificar resultado remoto antes de mostrar selección. EXPIRED efectivo sin prueba física debe permanecer indeterminado, sin reintento automático.
14. Contacto posterior: WhatsApp sólo del seleccionado autorizado/disponible, sin abrir automáticamente. Si se retira autorización, actualizar y comprobar mensaje de contacto no disponible.
15. Reportar solicitud/propuesta: controles secundarios y motivos reales, sin publicar información administrativa.
16. 320/375/390/430/768/1024/1440 px, zoom 200 %, teclado, Escape, foco al cerrar y mensajes largos. Sin scroll horizontal, botones tapados por MobileNav ni presupuestos en columnas demasiado estrechas.
17. Revisar Home, catálogo/fotografías, Actividad/Cuenta y formularios UX/UI 5 como regresión manual. No se ejecutó ninguna de estas pruebas durante la implementación.

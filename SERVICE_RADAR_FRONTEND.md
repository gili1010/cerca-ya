# CercaYa 2.0 — Frontend del Radar de servicios (Prompt 9)

## Estado

El usuario confirmó instalados y verificados los tres SQL del Radar: cinco tablas
con RLS, once RPC autenticadas, sin acceso directo/anónimo ni nuevas tablas en
Realtime. **No hay SQL adicional ni hace falta reejecutar esos archivos.**

Esta entrega implementa las pantallas sobre esos contratos. Revisión por lectura,
sin tests, lint, TypeScript, build, navegador, servidores, SQL, dependencias nuevas
o despliegues. Instalación confirmada por el usuario; compilación y comportamiento
real del frontend siguen pendientes de QA manual. No se declara PASS.

## Auditoría inicial

Se revisaron client/server/contracts/admin/types de service-radar, su guía de
instalación, SERVICES_SETUP, SERVICES_FRONTEND y SERVICES_SEARCH. También las
firmas SQL instaladas, Auth y retornos, Mi cuenta, Header, ServiceShell, selectores,
Mis servicios y patrones del Pedido Abierto/Radar comercial.

No existían rutas equivalentes para solicitudes/propuestas de servicios. Se
reutilizan PersonalShell, BackLink, Dialog, Auth, assertServiceSession, cliente
Supabase existente, ArticleLocality, catálogo de provincias, categorías reales,
precio ARS y normalización existente sólo para comparar datos recuperados.
No se implementa coincidencia de Radar ni autorización geográfica en JavaScript.

## Rutas

| Ruta | Uso |
| --- | --- |
| `/necesito-un-servicio` | Solicitud en tres pasos con borrador recuperable. |
| `/mis-solicitudes-servicio` | Solicitudes propias paginadas. |
| `/solicitud-servicio/[id]` | Detalle propio, propuestas recibidas, elección, contacto e historial. |
| `/solicitud-servicio/[id]/editar` | Editar sólo abierta, vigente, disponible y sin propuestas históricas. |
| `/radar-servicios` | Oportunidades compatibles y filtro de especialidad exacta. |
| `/radar-servicios/[id]` | Oportunidad autorizada y envío de propuesta. |
| `/mis-propuestas-servicio` | Propuestas enviadas, estados e historial paginado. |
| `/mis-propuestas-servicio/[id]` | Detalle propio, edición pendiente y retiro. |

Rutas dinámicas validan UUID antes de renderizar; las consultas reales se autorizan
en PostgreSQL. No existe listado público de necesidades. Todas estas pantallas
usan RadarFrame y sesión. Sin sesión se conserva el destino y se utiliza el login
existente; al cambiar de cuenta se desmonta el árbol privado por user.id.

Accesos: cuatro opciones en Mi cuenta, Necesito un servicio en navegación móvil
de Home y en la sección Servicios del explorador; Radar y Mis propuestas desde
la navegación existente de servicios. El Radar comercial y Pedido Abierto de
productos conservan rutas, lógica y botones existentes. No se imponen roles exclusivos.

## RPC utilizadas

| RPC | Uso de frontend |
| --- | --- |
| `save_my_service_request` | Alta con UUID persistido/expected_revision NULL; edición con revisión conocida. |
| `read_my_service_requests` | Listado, detalle, recuperación y verificación de estado. |
| `read_service_radar` | Listado y detalle por p_request_id; filtro p_category_id exacto. |
| `save_my_service_request_offer` | Envío/edición con servicio propio, UUID, JSON y revisión. |
| `read_service_request_offers` | seller=true para propias; false para recibidas; filtros request_id/offer_id. |
| `manage_my_service_request` | cancel/close/expire con revisión y confirmación. |
| `manage_my_service_request_offer` | accept/reject con ambas revisiones; withdraw con revisión de oferta. |
| `report_service_radar` | Denuncia autorizada de solicitud o propuesta. |
| `read_service_categories` | Grupos y especialidades reales activas. |
| `read_my_service_provider` | Requisitos profesionales; no se muestran campos privados/administrativos. |
| `read_my_service_listings` | Opciones propias publicadas y preparación del Radar. |

El detalle propio de propuesta puede leer una vez `read_my_service_listing` para
mostrar el título actual del servicio. Si falla, el historial continúa utilizable.
Los helpers Admin existentes quedan disponibles sin nuevas pantallas administrativas.

No se cambian firmas, tablas, policies, triggers ni estados del backend. Se amplía
únicamente el mapeo TypeScript de errores existentes con mensajes comprensibles.

## Circuito del vecino

1. Entrar por Necesito un servicio; iniciar sesión si corresponde. No se exige
   comercio ni perfil profesional.
2. Paso 1: título 8–120, descripción 20–2000, contadores y una especialidad hoja
   activa del catálogo. Los grupos sólo organizan el selector, no son seleccionables.
3. Paso 2: provincia oficial y localidad, usando ArticleLocality. La ubicación
   canónica puede completar inicialmente esos campos; no se solicita GPS, domicilio
   ni coordenadas. Sugerencias opcionales conservan el proveedor existente.
4. Paso 3: resumen, provincia, localidad, especialidad, vencimiento estimado a siete
   días y `serviceRequestPrivacyNotice`. La fecha definitiva la determina PostgreSQL.
5. Publicar: conservar UUID antes de escribir, validar sesión, consultar si ya existe,
   enviar la RPC y releer. Sólo se navega al registro confirmado cuando coincide.
6. Mis solicitudes muestra tarjetas, localidad, estado efectivo y fechas. El total
   autorizado de propuestas se muestra en el detalle; no hay una consulta por tarjeta.
7. Mientras siga abierta/disponible, editar si el total histórico es cero, cerrar
   sin elegir o cancelar. Las acciones irreversibles requieren confirmación.
8. Comparar propuestas recibidas, mensajes y modalidades sin ordenar ni recomendar
   por menor precio. Abrir perfil o servicio asociado existentes.
9. Elegir un profesional mediante la única RPC transaccional. La confirmación
   advierte cierre y rechazo de las otras pendientes. No se escribe cada estado
   por separado ni se declara que hubo contratación/pago/trabajo realizado.
10. La selección se confirma releyendo solicitud y propuesta: CLOSED,
    selected_offer_id correcto y ACCEPTED. Se muestra luego el contacto autorizado
    disponible y el historial.

## Circuito del profesional

1. Radar de servicios revisa perfil propio, cobertura, contacto autorizado y servicios
   publicados. Si falta preparación, muestra enlaces a Mi perfil profesional y Mis
   servicios. PostgreSQL sigue decidiendo el acceso y cada coincidencia.
2. Radar muestra sólo resultados de read_service_radar, sin filtrar una descarga
   nacional. Especialidad exacta y página se conservan en URL. Se utiliza my_offer_id
   para indicar que ya respondió y enlazar su propuesta, sin crear otra.
3. Abrir oportunidad vuelve a consultar la misma RPC por p_request_id. Si dejó de
   ser compatible/cerró/venció, no se abre un detalle público alternativo.
4. El formulario consulta servicios propios PUBLISHED mediante el lector autorizado.
   El backend admite como máximo 20 servicios no retirados; una página de 50 cubre
   ese conjunto. Si alguna respuesta estuviera truncada, el formulario no publica
   fingiendo que posee todas las opciones.
5. Opciones visuales: especialidad exacta, acepta consultas, perfil activo y ausencia
   de bloqueo en DTO propio. Esto no reemplaza la comprobación de cobertura, cuenta,
   consentimiento y elegibilidad de PostgreSQL al enviar/editar.
6. Elegir servicio, mensaje 10–1500 y modalidad: FIXED/FROM con importe positivo
   hasta dos decimales; QUOTE envía proposed_price=NULL. El servicio asociado no se
   puede cambiar al editar, según su inmutabilidad en backend.
7. Antes de escribir se reconsulta propuesta propia por solicitud y la oportunidad.
   UUID y datos permanecen conservados. Repeticiones no generan automáticamente
   otro identificador ni otra propuesta histórica.
8. Tras confirmación remota, Mis propuestas muestra estado real. Una pendiente puede
   editarse si sigue disponible/abierta o retirarse con confirmación. Retirada,
   rechazada y elegida son de sólo lectura, sin reactivar ni reenviar.
9. Si el historial aún dice pendiente pero la solicitud venció/cerró, se explica
   que ya no puede elegirse. PENDING no se interpreta como permiso vigente.

## Recuperación, revisiones y conflictos

- sessionStorage conserva borrador por cuenta: solicitud nueva o edición por id;
  propuesta por cuenta/solicitud. Incluye UUID, texto, localidad/presupuesto, paso,
  versión base y marca de resultado incierto. No se almacenan contactos ni firmas.
- Una copia temporal en memoria de esta pestaña conserva esos mismos borradores al
  desmontar/reabrir el formulario si falla una escritura en sessionStorage. No guarda
  DTO remotos ni campos de contacto. No sobrevive a recarga/cierre de la pestaña.
- Se escribe la identidad antes de la primera mutación. Un candado en memoria
  previene doble clic; los controles se deshabilitan durante escritura/incertidumbre.
- Red caída o respuesta no confirmada conserva los campos. Verificar estado guardado
  reconsulta la lectura propia; no se crea otro UUID. La UI compara campos guardados
  y versión cuando edita; no considera la mera presencia de una fila como prueba
  de que la edición enviada se confirmó.
- Si no existe el cambio y la lectura se pudo completar, se habilita revisar y
  reintentar con el mismo UUID. El siguiente envío vuelve a hacer prelectura.
- Ante SERVICE_RADAR_CHANGED o datos remotos distintos, se conserva el borrador y
  se ofrece Actualizar estado guardado. La versión anterior no se sobrescribe
  automáticamente. Al recuperar una versión nueva, descartar cambios y usar la
  versión guardada requiere una acción explícita.
- Detectar una revisión remota distinta bloquea otro guardado y la adopción de una
  copia vieja, hasta actualizar el estado guardado. Los parsers rechazan borradores
  fuera de longitud/formato en lugar de recortar silenciosamente su texto.
- Un borrador dañado no genera otro UUID silenciosamente. Se ofrece consultar
  registros y descartar sólo el borrador local con confirmación.
- Si el navegador no puede conservar una escritura de sessionStorage, se avisa que
  los datos siguen en memoria de esta pestaña. Si ni siquiera puede recuperar la identidad
  guardada, se bloquea la recuperación automática para no duplicar envíos.
- Cambiar cuenta invalida el árbol privado; antes de mutar se comprueba nuevamente
  la sesión. Las RPC verifican propietario y suspensión, incluso con UI antigua.
- Aceptar/rechazar/retirar/cerrar/cancelar reconsulta el estado final. Si se pierde
  la respuesta de elegir, se comprueban las tres condiciones de selección antes
  de mostrar la elección. No hay éxito optimista ni reintentos automáticos de escritura.
- Cerrar un diálogo incierto provoca relectura del historial antes de habilitar
  acciones otra vez. Nuevas revisiones se obtienen de esa lectura, no se inventan.
- Guardar una edición de propuesta invalida explícitamente su detalle y cierra la
  edición antes de volver a la misma URL. No se depende de que navegar a la misma
  ruta provoque otra consulta ni se deja visible el presupuesto anterior.

## Contacto y privacidad

Sólo la tarjeta del profesional seleccionado expone Contactar por WhatsApp, y
únicamente con contact_whatsapp no nulo y disponibilidad del DTO actual. Usa el
helper argentino existente y un mensaje para coordinar; nunca se abre automáticamente.
Si no está disponible, no se intenta obtener otro teléfono de perfil/Auth/tablas
privadas. El perfil público existente conserva sus reglas propias de contacto.

El profesional no recibe teléfono, email, identificador privado ni domicilio del
vecino. No se imprimen objetos de DTO completos ni datos administrativos, revisiones
o estados técnicos en UI. Las rutas contienen sólo IDs de entidades y parámetros
de navegación; no textos, teléfonos privados, coordenadas ni tokens. No se agregan logs.

Los textos de usuario se renderizan como texto React, sin HTML sin sanear. La
advertencia de privacidad aparece antes de publicar: no se promete eliminar datos
personales que alguien escriba en su descripción. Los borradores locales pueden
contener esos textos; en dispositivos compartidos conviene descartarlos después
de revisar el estado. No son una copia offline de las operaciones remotas.

Reportes: motivos exactos del catálogo, detalles opcionales hasta 1000, candado y
confirmación del UUID devuelto. Se muestran sólo donde el actor participa de forma
autorizada: prestador sobre oportunidad propia/ya respondida, vecino sobre propuestas
recibidas. PostgreSQL impide autoreporte, competidores y duplicados abiertos.

## Navegación, actualización y rendimiento

- Listas de 12 registros por página con total real del backend. Radar usa category
  (UUID exacto) y page; solicitudes/propuestas propias, page; recibidas, offer_page.
- returnTo sólo acepta las tres rutas de listado de este módulo y parámetros conocidos
  y validados. Se rechazan destinos externos, barras invertidas y controles.
- Entrar al detalle y volver restaura lista, especialidad y página. Los detalles
  públicos de servicio/perfil usan sus rutas existentes; Atrás del navegador conserva
  el detalle privado previo. No se relajan sus sanitizadores de retorno público.
- useRadarQuery vincula resultados a cuenta, alcance e intento; cambia de página/filtro
  y los resultados previos se ocultan. AbortController y cleanup ignoran respuestas
  atrasadas, incluso cuando un lector previo no admite señal.
- Botones Actualizar oportunidades/Actualizar propuestas/Actualizar estado guardado.
  Foco, visibilidad y reconexión también revalidan; eventos próximos se agrupan para
  evitar llamadas repetidas por la misma vuelta al foreground. No hay polling continuo.
- Temporizadores puntuales al vencimiento vuelven a consultar, sin nuevas suscripciones
  Realtime. El reloj del cliente sólo limita acciones visibles: PostgreSQL es autoridad.
- El editor de solicitudes también revalida al vencer. Un vencimiento ya atravesado
  se consulta una sola vez por marca de tiempo, incluyendo si venció durante la
  carga, sin entrar en un bucle cuando el reloj local difiere del servidor.
- La lista propia no consulta las propuestas de todas las solicitudes. Su detalle
  carga una página de recibidas y, si hace falta, una lectura del seleccionado fuera
  de esa página para no ocultar el contacto por paginación.
- Imágenes no forman parte de estas necesidades/propuestas; no se firman ni suben
  imágenes nuevas. No se añade otra búsqueda ni filtrado de cobertura en frontend.

## Vencimiento: límite real del DTO

La RPC devuelve EXPIRED efectivo, pero no revela si el estado físico sigue OPEN.
La UI respeta EXPIRED y ofrece Confirmar solicitud vencida mediante action=expire.
Con respuesta confirmada y relectura de revisión mayor + EXPIRED, se confirma esa
gestión y no se repite en la misma vista. Si ya estaba materializado, PostgreSQL
puede rechazar una repetición; la UI explica que sigue considerándose vencida.

Si se pierde la respuesta de expire, EXPIRED efectivo por sí solo **no demuestra**
que se materializó. Se conserva un resultado no confirmado y se permite cerrar y
revisar historial, sin afirmar un cambio interno inexistente. No se inventa raw_status,
no se modifica SQL y no se necesita materializar para impedir nuevas propuestas.
El diálogo dice expresamente «indeterminada» y, si se cierra sin poder confirmar,
el aviso permanece en el detalle mientras esa vista siga montada. Verificar resultado
sólo vuelve a leer: no reenvía expire. La confirmación requiere el acuse de la RPC,
una revisión mayor y EXPIRED. Después de una recarga no se infiere materialización:
el estado efectivo visible sigue siendo únicamente la prueba de que ya venció.

## Archivos de esta etapa

Nuevas rutas: los ocho page.tsx de la tabla inicial.

Nuevos componentes/estilos:
- `src/components/service-radar/radar-common.tsx`
- `src/components/service-radar/service-radar.module.css`
- `src/components/service-radar/request-editor.tsx`
- `src/components/service-radar/radar-lists.tsx`
- `src/components/service-radar/proposal-editor.tsx`
- `src/components/service-radar/radar-details.tsx`
- `src/components/service-radar/radar-confirm.tsx`
- `src/components/service-radar/radar-report.tsx`

Nuevas utilidades/documentación:
- `src/lib/service-radar/frontend.ts`
- `src/lib/service-radar/navigation.ts`
- `SERVICE_RADAR_FRONTEND.md`

Modificados:
- `src/components/auth/account.tsx`: cuatro accesos.
- `src/components/home/header.tsx`: acceso móvil para solicitar servicio.
- `src/components/personal-listings/publish-access.module.css`: wrap del acceso móvil.
- `src/components/services/service-shell.tsx`: navegación profesional.
- `src/components/services/service-search.tsx`: acceso a solicitar desde servicios.
- `src/lib/service-radar/contracts.ts`: textos de errores ya existentes.
- `SERVICE_RADAR_SETUP.md`: estado instalado confirmado y referencia a esta guía.

### Cierre de la continuación del Prompt 9

No se crearon rutas nuevas ni se reimplementaron las existentes en esta continuación.
Se conservaron los archivos del working tree y se ajustaron exclusivamente:

- `src/components/service-radar/radar-common.tsx`: recuperación temporal en memoria
  y reconsulta puntual de vencimiento sin bucles.
- `src/components/service-radar/request-editor.tsx`: validaciones completas de longitudes,
  localidad, revisión y bloqueo de conflicto hasta actualizar.
- `src/components/service-radar/proposal-editor.tsx`: bloqueo ante conflicto y reconsulta
  explícita del detalle después de confirmar una edición.
- `src/components/service-radar/radar-details.tsx`: cierre de edición confirmada,
  reconsulta sólo de solicitudes abiertas y aviso de expire indeterminado.
- `src/components/service-radar/radar-confirm.tsx`: comunicación del resultado de expire
  indeterminado al detalle, sin inferirlo de la lectura ni reenviarlo automáticamente.
- `src/lib/service-radar/frontend.ts`: validación de borradores sin truncamiento silencioso.
- `SERVICE_RADAR_FRONTEND.md`: estas correcciones y escenarios adicionales de QA.

Revisión de privacidad por lectura: lectores propios filtran propietario en PostgreSQL;
propuestas profesionales usan p_seller=true, sin consultas a ofertas competidoras.
El DTO público reconstruye campos permitidos y omite requester_id y datos de Auth.
WhatsApp procede exclusivamente de contact_whatsapp de la propuesta elegida. No se
cambiaron esos contratos, políticas, auxiliares SQL ni funciones de autorización.

## Prueba manual detallada pendiente

Preparar vecino QA, dos profesionales QA y opcional Admin QA. No compartir claves
ni usar pedidos reales. Usar títulos/mensajes `[QA]`. Las pruebas no se ejecutaron.

1. Sin sesión, abrir cada ruta privada; verificar login y regreso a esa misma ruta.
   Cambiar cuenta y comprobar que no se conserve información remota de la anterior.
2. Como vecino sin comercio ni perfil profesional, entrar a Necesito un servicio.
   Probar mínimos/máximos, contadores, categoría hoja y resumen. Los grupos no deben
   publicarse como especialidades. Revisar sólo provincia/localidad, sin domicilio/GPS.
3. Completar `[QA] Necesito un electricista`, descripción válida y Alta Gracia/Córdoba.
   Avanzar/volver, recargar antes de enviar y verificar que el borrador se recupera.
   Publicar una vez, probar doble clic y verificar un único registro con siete días.
4. Simular pérdida de red durante la publicación y después de enviar al servidor.
   Recuperar conexión, verificar estado, mantener el mismo borrador e identificador.
   No deben mostrarse éxito ni otra alta hasta confirmar. Probar borrador dañado o
   almacenamiento bloqueado: advertencia y descarte explícito, sin duplicación silenciosa.
5. Editar la solicitud sin propuestas. En dos pestañas, guardar desde una y luego
   desde la otra: conservar campos locales, exigir actualización y no sobrescribir.
6. Profesional con referencia Anisacate y cobertura Alta Gracia: perfil activo,
   contacto autorizado y servicio público de Electricidad que acepta consultas.
   En Radar debe ver la oportunidad; varios servicios compatibles no la duplican.
   Otra especialidad, localidad no cubierta o solicitud propia no deben aparecer.
7. Probar perfil ausente, sin cobertura, sin servicio publicado, sin consentimiento,
   inactivo/no habilitado: mensajes de preparación o permiso, con enlaces correctos.
8. Filtrar especialidad exacta, paginar y abrir oportunidad. Volver: conservar filtro
   y página. Cambiar rápido de filtro/página con red lenta: no reaparecen resultados viejos.
9. Enviar QUOTE sin precio. Repetir con otro profesional usando FROM o FIXED con
   importe real. Probar cero, negativo, exceso de decimales, mensaje corto/largo.
   Sólo se ofrecen servicios propios publicados, de especialidad exacta y con consultas.
10. Simular envío incierto: verificar en Mis propuestas, mantener mensaje/precio e
    identificador y no crear otra propuesta para la misma solicitud. Al editar,
    no se cambia el servicio asociado. Retirar y comprobar que no se puede reenviar.
11. Pausar servicio, quitar cobertura o habilitación antes de enviar/editar: PostgreSQL
    debe rechazar. Actualizar la oportunidad debe ocultarla cuando deje de ser elegible.
12. Volver como vecino. El detalle muestra total de propuestas y páginas, mensajes,
    diferencia precio fijo/desde/a presupuestar, perfil y servicio asociado. No hay
    ranking que recomiende al más barato ni contacto privado del solicitante.
13. Con una propuesta histórica, intentar edición por enlace directo: no debe permitir
    cambiar condiciones. Probar cerrar sin elegir y cancelar en solicitudes QA distintas;
    confirmar, releer y comprobar pendientes rechazadas e historial terminal.
14. Rechazar una propuesta y comprobar estado remoto. Las otras se pueden comparar.
    Como profesional no debe poder leerse ni modificarse la propuesta de un competidor
    cambiando un UUID en URL; otro vecino tampoco puede abrir la solicitud propia ajena.
15. En dos pestañas del vecino, elegir profesionales diferentes casi simultáneamente:
    sólo uno ACCEPTED, solicitud CLOSED y seleccionado correcto; las otras pendientes
    rechazadas. La segunda pestaña debe pedir actualización, sin éxito falso.
16. Cortar red al elegir. Verificar resultado con lecturas de solicitud/propuesta.
    Mostrar elección sólo cuando las tres condiciones coinciden. No abrir WhatsApp solo.
17. Con seleccionado y contact_whatsapp autorizado, tocar Contactar por WhatsApp y
    revisar número/mensaje. Revocar contacto o disponibilidad, actualizar y comprobar
    que no se busca otro teléfono y aparece contacto no disponible.
18. Ver el profesional elegido desde Mis propuestas: sólo historial, sin teléfono
    automático del vecino ni promesa de trabajo pagado/completado.
19. Preparar en un entorno QA una solicitud vencida según backend, o esperar el plazo.
    Debe verse vencida aun si físicamente OPEN; no permite enviar/elegir/reabrir/extender.
    Probar confirmar vencimiento normal, repetido e incierto: no afirmar materialización
    solamente porque el DTO efectivo diga EXPIRED.
20. Reportar solicitud como profesional autorizado y propuesta como su comprador.
    Motivos exactos, detalles opcionales, duplicado abierto no duplica y no autoreporte.
    No se envía ningún reporte automáticamente al abrir el formulario.
21. Revisar móvil y teclado: foco, campos, diálogos, cierre, botones táctiles, precios y
    textos largos, navegación sin overflow. Volver del background y recuperar conexión:
    revalidación con lecturas, sin suscripciones nuevas ni escrituras automáticas.
22. Verificar límites con datos QA y respuesta amigable, sin generar otros UUID para
    evadirlos. Comprobar regresión de productos/Pedido Abierto/Radar comercial,
    reservas/carrito, particulares, búsqueda y administración de servicios existentes.

Pruebas específicas de cierre, también pendientes de ejecución:

23. Editar una propuesta pendiente y guardar volviendo a su misma URL. Debe cerrarse
    el editor y verse el presupuesto/mensaje releído del servidor, sin recarga manual.
24. Tras recuperar un borrador, guardar una edición diferente en otra pestaña. Verificar
    estado en la primera: conservar los campos, bloquear Guardar y exigir Actualizar
    estado guardado antes de ofrecer adoptar la nueva versión. No actualizar la revisión
    local silenciosamente ni sobrescribir la edición ajena.
25. Si falla sólo la escritura de sessionStorage, cambiar de foco o actualizar el
    formulario sin recargar la pestaña: recuperar el mismo UUID, texto y marca incierta
    desde memoria. Debe advertir que cerrar/recargar la pestaña no garantiza recuperación.
26. Preparar un borrador corrupto/fuera de longitud en un entorno QA. No debe recortar
    silenciosamente texto, mostrar éxito ni generar otro UUID sin descarte explícito.
27. Hacer que una solicitud venza durante la lectura o mientras se edita: una reconsulta
    puntual debe renovar su disponibilidad; no debe entrar en consultas repetitivas ni
    habilitar edición/envío sobre el estado EXPIRED recibido.
28. Perder específicamente la respuesta de expire y provocar después otra revisión
    administrativa del registro QA: EXPIRED más revisión mayor tampoco confirma por sí
    solo la materialización. Verificar resultado debe limitarse a lecturas; cerrar el
    diálogo mantiene el aviso indeterminado en el detalle. No se reenvía expire al foco,
    reconexión o refresco ni se presenta esa lectura como éxito de la acción.

## Limitaciones pendientes

QA real y compilación pendientes por instrucción. El panel administrativo completo
queda para otra etapa; backend/helpers ya existen. No se agregan pagos, agenda,
calificaciones, mensajes, notificaciones push/email ni contratación automática.

El DTO de oferta no incluye el título histórico del servicio. Se enlaza el servicio
asociado y el detalle propio puede resolver su título actual; no se inventa un snapshot
ni se agrega una consulta por tarjeta. Totales de propuestas sólo en el detalle.
Los borradores pertenecen al navegador/sesión y cuenta, no se sincronizan entre
dispositivos; los registros ya confirmados se recuperan mediante listas autorizadas.
Cambios remotos se reflejan al actualizar/foco/reconexión, no instantáneamente por
Realtime. La distinción física de vencimiento no puede inferirse del DTO efectivo.

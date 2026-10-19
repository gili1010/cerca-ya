# CercaYa — UX/UI 5: publicar y solicitar

## Alcance y revisión

Continuación sobre el working tree existente. Los cambios de UX/UI 4 permanecen; no se rehicieron. Revisión por lectura de rutas, componentes, hooks y diff, con las guías UX_UI_GUIDELINES, UX_UI_HOME, UX_UI_SEARCH, UX_UI_DETAILS, SERVICES_FRONTEND, SERVICE_RADAR_FRONTEND, PERSONAL_LISTINGS_FRONTEND y REQUEST_SETUP como contexto. REQUEST_SETUP conserva referencias históricas: el componente actual NewRequest y RequestLocation son la referencia del flujo comercial vigente.

No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni despliegues. No se instalaron dependencias. Este documento describe implementación y revisión estática, no una validación PASS de ejecución.

No cambia SQL, RPC, contratos, RLS, UUID, revisiones, persistencia, permisos, Auth, Storage, firmas, compresión, stock, carrito ni coincidencia geográfica. No se modifican el encuadre o la grilla de tarjetas comerciales. No se inició UX/UI 6.

## Auditoría inicial

| Ruta / componente real | Hallazgo | Intervención |
| --- | --- | --- |
| /publicar — PublishOptions | Sólo agrupaba formas de ofrecer; no distinguía vender de solicitar. | Dos grupos por intención, usando cinco rutas existentes. |
| /publicar/articulo y /mis-publicaciones/[id]/editar — ArticleEditor / useArticleEditor | Cuatro pasos con guardado y recuperación reales; indicador pequeño y estados distribuidos. | Progreso compartido, estado visible, ayudas de precio/localidad/contacto, errores de campo existentes y vista previa identificada. |
| /publicar/servicio y /mis-servicios/[id]/editar — ServiceEditor | Necesita un perfil previo y guarda al continuar; precio y presupuesto requerían explicación. | Cuatro pasos intactos, explicaciones por modalidad de precio y avisos honestos de guardado/recuperación. |
| /mi-perfil-profesional y entrada inicial desde servicio — ProfessionalProfile | Perfil, cobertura y foto se guardan por separado; podían parecer un formulario único. | Tres secciones explícitas, foto opcional plegable, avisos de guardado separado y contacto público. |
| /pedido/nuevo — NewRequest | Formulario único con ubicación comercial requerida; incluía una falsa acción futura para fotos. | Dos bloques dentro del mismo formulario, copy de necesidad, ubicación/urgencia/radio agrupados y aclaración de que no admite foto. |
| /necesito-un-servicio y /solicitud-servicio/[id]/editar — RequestEditor | Tres pasos con borrador local, revisión y resultado incierto; poca jerarquía entre esos estados. | Progreso compartido, ayudas de longitud/privacidad, resumen y siete días explícitos, estados diferenciados. |
| ArticlePhotos / ServicePhotos | Controles de miniaturas apretados, mensajes técnicos de subida. | Controles en grilla táctil, selector claro y reglas propias visibles. |
| ArticlePresentation / ServicePresentation | Las vistas previas repetían h1 de la pantalla. | Sólo la vista previa usa h2; el detalle público conserva su h1 y diseño. |
| BuyerRequestDetail con confirmation=true | Confirmación comercial existente y validada con lectura propia. | Superficie visual compartida, sin cambiar su lógica ni el detalle/listado. |

La creación de tienda continúa en /comercio/crear: sólo se presenta como opción, sin rediseñar su formulario o panel. Los componentes PublicationAuthGate, ServiceAuthGate, requireUser/RequireAuth y RadarFrame mantienen las rutas de regreso y el desmontaje por cuenta. No se cambian login ni registro.

## Entrada Publicar

Quiero ofrecer: Vender un artículo (/publicar/articulo), Ofrecer un servicio (/publicar/servicio), Crear mi tienda (/comercio/crear).

Estoy buscando: Necesito un producto (/pedido/nuevo), Necesito un servicio (/necesito-un-servicio).

Tarjetas completas como enlaces, iconos Lucide decorativos, títulos/descripciones y flecha. Hover discreto, foco visible, tres opciones de oferta y dos de necesidad en escritorio; una columna en móvil. La navegación global no cambia y no se exige rol exclusivo.

## Presentación compartida

publish-flow.module.css se aplica a wrappers concretos, no a formularios de toda la aplicación. Conserva tokens verdes, superficies claras, tipografía de 16 px en campos y 14 px en ayudas, bordes suaves, espacio de 24–32 px y botones existentes de 48 px.

PublishProgress recibe sólo pasos e índice. Muestra Paso X de N, nombre actual y numeración. No guarda datos, no navega, no genera UUID y no habilita acciones. No marca pasos anteriores como completados: avanzar no garantiza que futuras ediciones sigan guardadas. Los botones Anterior/Volver existentes mantienen el recorrido y los datos.

PublishFieldFeedback reutiliza mensajes ya generados por los validadores. fieldFeedback selecciona prefijos conocidos de esos mensajes para mostrarlos junto a título, categoría, precio o contacto; no valida de nuevo, no cambia los textos ni las reglas. Se conservan también los resúmenes con role=alert. Los campos identificables usan aria-invalid y aria-describedby. Los errores agrupados/remotos sin campo inequívoco siguen en el resumen: no se inventa un campo culpable ni se oculta el error global.

## Artículos particulares

Se conservan los cuatro pasos originales porque las operaciones remotas dependen de su orden:
1. Datos: título, descripción, categoría real, condición, precio, negociabilidad y localidad.
2. Fotografías: selección, orden y principal.
3. Contacto: nombre público opcional, WhatsApp y autorización expresa.
4. Revisar: vista previa privada y confirmación.

No se reubican datos entre pasos del asistente ni se agregan validaciones. No se exige comercio. Precio utiliza el validador actual, incluyendo su aceptación de cero; no se modifica la regla monetaria.

El estado usa dirty, busy, preparing, frozen, error y base del editor existente. Distingue cambios sin guardar, guardando/comprobando, preparación de fotos, último intento no completado, versión guardada y resultado pendiente de revisión. No muestra guardado si hay cambios locales o error. Se conserva el aviso de salida beforeunload que ya usa el hook.

La confirmación mantiene su condición remota existente y ofrece Ver publicación, Mis publicaciones y Publicar otro artículo. Este último abre de nuevo la ruta existente; no cambia el generador de UUID ni el sistema de recuperación. SOLD/WITHDRAWN, suspensión y bloqueo conservan los controles deshabilitados y mensajes actuales.

## Perfil profesional inicial

Un mismo perfil se reutiliza para todos los servicios. No hay un perfil por cada trabajo ni una tienda artificial.

1. Mi perfil profesional: nombre, presentación, localidad de referencia, WhatsApp autorizado y estado activo. La referencia no declara automáticamente cobertura.
2. Dónde trabajo: localidades compartidas, hasta 30, con elementos fáciles de quitar. Conserva normalización, prevención de duplicados y guardado independiente.
3. Foto o logo opcional: bloque details/summary nativo, con sus acciones originales de foto y limpieza. No bloquea el acceso a guardar perfil o cobertura.

El estado visual compara formulario/fotos/cobertura con la lectura propia ya cargada para avisar de cambios pendientes; no dispara escrituras ni cambia permisos. Cada sección conserva su propio botón de guardado. Perfil, cobertura y foto no se presentan como una transacción única. El consentimiento sigue desmarcándose al editar el número. El ancla professional-whatsapp permite llegar al campo desde la vista previa del servicio cuando falta contacto.

## Servicio profesional

Se conservan cuatro pasos: Servicio; Modalidad y precio; Fotos opcionales; Revisar.

Especialidades reales agrupadas del catálogo actual; los grupos no se convierten en categorías publicables. Modalidades actuales ONSITE/AT_PROVIDER/REMOTE intactas. Precio fijo explica importe definido; Desde explica referencia mínima; A presupuestar explica acuerdo según trabajo. QUOTE sigue ocultando el campo de importe y enviando NULL mediante input() existente, nunca cero.

El indicador de cambios pendientes compara la entrada actual con inputOf(base) y el orden/referencias de fotos existentes. Es sólo presentación, no otro sistema de persistencia. La revisión y el bloqueo frozen siguen siendo fuente de verdad. Guardar y Continuar siguen ejecutando operate/persist con sus verificaciones actuales.

La vista previa usa base y URLs resueltas existentes; no intenta publicar borradores como detalles públicos. Para un servicio ya publicado se aclara que guardar aplica sus cambios. La falta de WhatsApp ofrece el enlace al campo correspondiente del perfil. La confirmación conserva la relectura de estado/revisión y disponibilidad pública. Publicar otro servicio reutiliza startAnother sólo en el flujo nuevo, sin alterar edición con listingId.

## Solicitud de producto comercial

Sigue siendo un único formulario: no se crean pasos ni una vista previa que implique un borrador remoto inexistente.

Qué estás buscando: título prellenado existente, descripción y categoría.
Dónde y hasta cuándo buscar: RequestLocation actual, urgencia y radio. Se mantienen valores, handlers, autorizaciones y vencimientos reales. Este flujo actualmente requiere coordenadas: se respeta esa diferencia con los flujos por localidad. Las coordenadas se fijan al publicar y su privacidad no cambia.

Se explica que no es venta ni compra automática. Se retira la presentación de botón Próximamente para fotos y se aclara que el pedido se publica sin fotografía. No se promete envío de ofertas o notificaciones.

Conserva submission.current, bloqueo inFlight, tratamiento de respuesta incierta y reintento idempotente con los mismos datos/ubicación. La confirmación existente se presenta con el estilo compartido, después de su lectura propia. No se cambia BuyerRequestList ni la gestión normal de pedidos.

## Solicitud de servicio

Tres pasos existentes: Qué necesitás; Dónde; Revisar. Título 8–120 y descripción 20–2000 con ayudas vinculadas, especialidad hoja real y aviso de privacidad. Provincia/localidad sin GPS ni domicilio exacto.

Resumen de datos locales autorizado, vencimiento a siete días con fecha estimada y aclaración de que PostgreSQL fija la definitiva. En edición muestra la fecha real existente.

Mantiene useRadarDraft, UUID, revisión, guardado de avance en navegador, advertencias de almacenamiento, confirmación remota, conflicto entre pestañas y restricciones por propuestas históricas. El mensaje distingue explícitamente borrador del navegador de solicitud guardada en la cuenta. No promete sincronización entre dispositivos.

La publicación confirmada conserva la navegación inmediata al detalle propio; no se agrega una pantalla intermedia ni una escritura por motivos visuales. Desde allí se mantienen los accesos existentes a Mis solicitudes. Las respuestas inciertas exigen Verificar estado guardado y no se convierten en éxito por apariencia. No se modifican propuestas, estados terminales ni materialización de EXPIRED.

## Fotografías, localidad y privacidad

Particulares: una a cinco fotos para publicar; borrador sin fotos permitido según flujo existente. Servicios: hasta cinco opcionales. Perfil: una foto/logo opcional. Controles de mover, principal y quitar conservan sus handlers; miniaturas en tres columnas desktop y dos móvil, con controles de al menos 44 px. No se cambian imagen de catálogo, Storage, compresión, formatos aceptados, límites reales, recuperación, limpieza ni hooks de renovación de URLs.

ArticleLocality conserva provincia oficial, datalist y sugerencias opcionales actuales. El contexto de cada pantalla explica artículo, referencia, cobertura o lugar donde se necesita trabajo. No se inventan reglas ni distancias.

Se explica el consentimiento antes de la casilla de WhatsApp, sin activarlo automáticamente y sin copiar contactos privados de Auth. Los DTO de vista previa siguen siendo los existentes del propio editor; no se agregan lecturas privadas o datos administrativos públicos.

## Responsive y accesibilidad

Formularios de máximo 850 px, ancho fluido y padding menor en móvil. Una columna de acciones en móvil sin cambiar orden de Tab; no se crea ninguna barra sticky ni se duplica el espacio inferior global de MobileNav. Progreso móvil compacto con el nombre del paso actual y nombres accesibles de cada elemento.

Inputs de 16 px y alto mínimo 48 px, teclado decimal/teléfono según campos reales, labels implícitos/for existentes, ayudas asociadas, foco visible, error summary enfocable y progreso anunciado. Foto opcional con disclosure nativo operable por teclado. No se agregan animaciones; se conserva la regla global de movimiento reducido.

## Archivos de esta etapa

Creados:
- src/components/publish/publish-progress.tsx
- src/components/publish/publish-field-feedback.tsx
- src/components/publish/publish-flow.module.css
- src/components/publish/publish-options.module.css
- UX_UI_PUBLISH.md

Modificados:
- src/components/personal-listings/publish-options.tsx
- src/components/personal-listings/article-editor.tsx
- src/components/personal-listings/article-photos.tsx
- src/components/personal-listings/article-presentation.tsx (sólo nivel del título de vista previa)
- src/components/services/service-editor.tsx
- src/components/services/professional-profile.tsx
- src/components/services/service-areas-editor.tsx
- src/components/services/service-photos.tsx
- src/components/services/service-presentation.tsx (prop preview opcional; públicos sin cambios)
- src/components/service-radar/request-editor.tsx
- src/components/requests/new-request.tsx
- src/components/requests/buyer-requests.tsx (sólo clase de la confirmación)

No se cambia UX_UI_GUIDELINES.md: se aplican sus tokens y criterios existentes mediante componentes acotados. Los archivos previos modificados de UX/UI 4 no se atribuyen nuevamente a esta etapa.

## Limitaciones y decisiones seguras

- Revisión estática únicamente. Compilación, responsive, lector de pantalla y operación remota requieren QA manual.
- Se conserva el número de pasos; el primero de artículo contiene varios campos por dependencia de guardado real. No se movieron a pasos ficticios.
- La validación de servicio vigente evalúa sus datos generales también al avanzar; no se relajan validadores por estética.
- Los contratos no entregan todos los errores por campo. Se ubican cerca del campo sólo mensajes existentes inequívocos; el resto sigue en resumen.
- beforeunload se conserva donde ya existe (artículo). No se incorpora un interceptor global de navegación ni autosave remoto a los demás flujos. Guardar cada sección sigue siendo necesario; los nuevos avisos no garantizan recuperación de campos nunca guardados.
- La solicitud comercial no tiene un borrador remoto/preview equivalente al de publicaciones. No se simula. Su UUID de reintento permanece en memoria del formulario según diseño actual.
- El vencimiento estimado de solicitud de servicio conserva el cálculo existente; la fecha remota es definitiva.
- Las confirmaciones de solicitudes conservan sus rutas actuales; no se agregan páginas o estados de éxito alternativos.

## Pruebas manuales pendientes

1. /publicar en 320/375/390/430/768/1440 px: cinco enlaces completos, orden por intención, Tab/Enter, foco y sin overflow. Crear tienda debe conservar la ruta/formulario anterior.
2. Sin sesión, abrir cada opción y comprobar regreso tras login/registro. Cambiar de cuenta y verificar que no se mezclan borradores o datos.
3. Artículo [QA]: datos inválidos y mensajes junto a título/categoría/precio/contacto; corregir y avanzar, volver atrás, guardar, recargar y retomar desde Mis publicaciones. Verificar que el número de pasos no cambió.
4. Artículo: intentar publicar sin foto y sin autorización. Agregar hasta cinco fotos, mover, elegir principal, quitar y reintentar después de error. Cambiar el teléfono debe desmarcar consentimiento.
5. Publicar artículo y revisar confirmación, Ver publicación, Mis publicaciones y Publicar otro artículo. Comprobar títulos semánticos de preview y detalle público.
6. Sin perfil profesional: completar datos de referencia, crear perfil, agregar/quitar cobertura, guardar cada sección y abrir foto opcional. Verificar máximo 30 y duplicados, sin confundir referencia con cobertura.
7. Servicio [QA]: precio fijo, desde y QUOTE; comprobar que este último no pide importe ni publica cero. Continuar sin fotos, luego con hasta cinco y verificar recuperación/reordenamiento/limpieza existentes.
8. Servicio: perfil sin contacto o cobertura, enlace al campo WhatsApp, consentimiento y reintento. Guardado confirmado, cambios locales y resultado incierto deben distinguirse.
9. Pedido comercial [QA]: prellenado desde búsqueda, categorías, ubicación autorizada, radio y urgencia. Comprobar publicación y confirmación real sin fotos, sin promesas de respuestas recibidas.
10. Solicitud de servicio [QA]: tres pasos, límites de longitud, localidad, preview y siete días. Volver, recargar borrador, confirmar y comprobar que navega al detalle sólo tras lectura remota válida.
11. Interrumpir red durante guardado/subida/publicación; verificar mismo UUID, bloqueo y recuperación manual. No repetir operaciones automáticamente ni crear duplicados.
12. Editar el mismo borrador desde dos pestañas: conflicto visible, datos locales conservados, recarga explícita con advertencia. Retirados/vendidos/bloqueados y solicitudes con propuestas siguen sin edición no autorizada.
13. Esperar renovación de firmas y alternar pestañas: fotos recuperables sin tocar URLs permanentes. Probar archivos no admitidos y errores reales de tamaño conservando los mensajes existentes.
14. Zoom 200 %, teclado, foco de errores, lector de pantalla, modo reducido y teclado móvil; comprobar acciones y final del formulario sin superposición con MobileNav.
15. Revisar Home, buscador, tarjetas comerciales y detalles UX/UI 4 como comprobación de regresión visual, sin modificar datos reales ni realizar pagos.

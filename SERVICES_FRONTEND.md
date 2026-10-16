# CercaYa 2.0 — Frontend de servicios (Prompt 6)

## Estado y límites de la revisión

El usuario confirmó instalados y verificados services.sql, services-access.sql
y services-moderation.sql. Esta etapa usa ese backend; **no requiere SQL
adicional ni modifica los tres archivos ejecutados**.

Se continuó el working tree existente, sin rehacer los módulos terminados.
Revisión por lectura de archivos/diff y contratos. No se ejecutaron tests,
lint, TypeScript, build, navegador, servidores, SQL ni despliegues; no se
instalaron dependencias. Compilación y funcionamiento real quedan pendientes
de la prueba manual del usuario, sin declarar PASS.

El Prompt 7 ahora integra servicios al buscador general: ver
[SERVICES_SEARCH.md](SERVICES_SEARCH.md). No hay carrito, stock,
reservas, turnos, pagos, Radar ni panel Admin nuevo.

## Rutas y navegación

| Ruta | Uso |
| --- | --- |
| /publicar | Ofrecer un servicio habilitado; conserva artículos particulares y crear tienda. |
| /publicar/servicio | Si no hay perfil, permite crearlo y continuar; si existe, editor de cuatro pasos. |
| /mi-perfil-profesional | Perfil, localidad de referencia, WhatsApp, consentimiento, activo/inactivo, cobertura y avatar. |
| /mis-servicios | Listado propio por estado, paginación y administración. |
| /mis-servicios/[id] | Registro propio; retirados sólo lectura. |
| /mis-servicios/[id]/editar | Edición, revisión y administración de fotos. |
| /servicio/[id] | Detalle público elegible, contacto y reporte. |
| /prestador/[id] | Perfil público, cobertura, servicios por localidad y reporte. |

Mi cuenta incorpora Mis servicios y Mi perfil profesional. ServiceShell
reutiliza PersonalShell y añade navegación de servicios adaptable a móvil,
sin quitar accesos existentes. Las rutas autenticadas usan ServiceAuthGate,
el login/registro existente y redirect interno. PublicationAuthGate conserva
su comportamiento por defecto para artículos; cambia sólo el copy para servicios.
Al cambiar cuenta se desmonta el árbol privado mediante key del usuario.

Las rutas públicas cargan exclusivamente DTO públicos del acceso SSR existente,
sin owner_id, campos administrativos, coordenadas ni información de Auth.
UUID inválido o entidad no pública muestra el estado no disponible, sin consulta
a tablas privadas ni fallback a mocks.

## Crear perfil profesional

1. Entrar en Publicar → Ofrecer un servicio o Mi cuenta → Mi perfil profesional.
2. Iniciar sesión si corresponde. No se exige comercio ni rol especial.
3. Indicar nombre público, presentación opcional, provincia y localidad.
4. Guardar. WhatsApp, cobertura y avatar pueden completarse después.
5. Completar WhatsApp argentino y autorizar expresamente su divulgación.
   Cambiar el número desmarca el consentimiento. No se copian datos de
   Auth/profiles a campos públicos.
6. Elegir provincia/localidad en cobertura, agregar hasta 30 y Guardar cobertura.
7. Si se desea, seleccionar foto/logo y Guardar foto de perfil.

Los formularios de datos, cobertura y avatar se guardan separadamente.
Antes de abandonar la pantalla, guardar cada sección modificada.
Referencia y cobertura no se confunden: vivir en Anisacate no declara
automáticamente atender allí. La cobertura se aplica a todos los servicios.

Los controles reutilizan el catálogo argentino y sugerencias Geoapify actuales,
con texto manual cuando no hay sugerencias/proveedor. Se normalizan espacios
y se impiden duplicados por acentos/case/espacios. La coincidencia sigue el
contrato textual canónico existente; no hay GPS, domicilio exacto, centroides
ni kilómetros ficticios. Se corrigió el ID del datalist compartido con useId
para que referencia y cobertura no mezclen sus sugerencias.

## Publicar el primer servicio

1. Ofrecer un servicio: título, especialidad y descripción.
   Categorías reales de read_service_categories, agrupadas por sus cinco grupos;
   los grupos no son opciones publicables.
2. Guardar y continuar crea o actualiza DRAFT usando un UUID estable.
3. Elegir modalidad: a domicilio/lugar coordinado, en el lugar del prestador
   (sin mostrar domicilio) o remoto.
4. Elegir precio fijo, desde o A presupuestar. FIXED/FROM requieren importe
   positivo hasta dos decimales, sin separadores de miles. QUOTE envía NULL
   aunque haya quedado un importe local de una selección anterior.
5. Fotografías opcionales: continuar sin ninguna es válido. O agregar hasta
   cinco, reordenar, elegir principal con la estrella o quitar.
6. Guardar y continuar sube versiones comprimidas al bucket privado,
   registra las referencias por RPC y recupera la revisión.
7. Revisar la presentación construida con la lectura propia, no la RPC pública.
8. Publicar servicio. Se exige perfil activo, cobertura, contacto consentido,
   categoría elegible y ausencia de bloqueos; PostgreSQL autoriza finalmente.
   Sólo se muestra éxito después de releer estado/revisión propios y comprobar
   elegibilidad mediante read_public_service_listing.

Guardar borrador y cambios permite salir sin publicar (requiere los datos mínimos
que exige save_my_service_listing). Editar un servicio publicado aplica los cambios
al guardar, sin convertirlo a DRAFT. Para ocultarlo, Pausar desde Mis servicios.

Al volver a /publicar/servicio se recupera la publicación iniciada en esa sesión.
Crear otro servicio es una acción explícita: conserva el anterior en Mis servicios
y usa un UUID nuevo sólo por esa intención. No se inicia otro automáticamente por
error de red. Si el recordatorio apunta a un retirado, se ofrece crear otro; el
registro retirado permanece inmutable.

## UUID, revisiones y recuperación

- Provider/listing UUID permanecen en memoria y sessionStorage por usuario;
  no se guardan formularios privados ni URLs firmadas allí.
- Si sessionStorage está bloqueado, se mantiene la protección en memoria;
  tras cerrar/recargar, recuperar los registros confirmados desde Mi perfil/Mis servicios.
- Perfil incierto: consulta read_my_service_provider, conserva el UUID y bloquea
  nuevos envíos hasta recargar los datos guardados.
- Servicio incierto: consulta read_my_service_listing con el mismo UUID.
  Si aparece, informa que hay una versión guardada; no adopta su revisión como
  permiso para sobrescribirla ni promete que la operación propia fue exitosa.
- SERVICE_CHANGED, bloqueo o respuesta no confirmada congela el editor y ofrece
  recarga explícita, que descarta los cambios locales. No se reintenta a ciegas.
- Bloqueos de envío por ref + botones busy previenen doble clic. Las revisiones,
  unicidad y cupo del backend siguen siendo la autoridad.
- Antes de etapas de escritura/subida se comprueba que continúe la misma sesión;
  no se cambia la infraestructura Auth. Al desmontar no se encadenan más subidas.

## Fotos, recuperación y limpieza

Se reutiliza src/lib/services/images.ts: compresión JPEG/WebP, límite 2 MiB,
bucket privado service-images. Hasta cinco fotos vinculadas y temporales acotados
por el backend; avatar opcional con reemplazo versionado.

Flujo: crear DRAFT → subir una ruta nueva → registrar referencias con revisión →
releer → limpiar sólo bytes no vinculados por Storage API. La principal es
posición 0; flechas/estrella cambian el orden antes de guardar.
No hay fotografías/credenciales generadas ni ejemplos que se presenten como reales.

Ante subida incierta, no borrar compensatoriamente: recargar y usar Recuperar
fotos temporales (o Recuperar foto temporal en perfil). Se muestran como borrador
para revisar y guardar. Si ya hay cinco fotos, quitar alguna antes de recuperar
otras. La limpieza es explícita, con confirmación y aviso de cerrar otras pestañas;
RLS vuelve a comprobar que un archivo no esté vinculado.

useSignedServicePhotos mantiene firmas sólo en memoria, por cuenta y conjunto de
rutas. Renueva un minuto antes del TTL de diez minutos, al volver a foco si hace
falta, al volver visible y al recuperar conexión. Fallas individuales mantienen
placeholders y reintento; no bloquean el contenido. Listados firman sólo las
principales de su página y detalles su galería/avatar.

Los Object URLs de fotos locales se revocan al quitarlas, reemplazarlas, guardar
o desmontar. Una URL firmada ya emitida puede seguir funcionando hasta su
vencimiento, según el patrón existente; bloquear niega nuevas firmas.

## Mis servicios y estados

- DRAFT: continuar edición, publicar si cumple requisitos, retirar.
- PUBLISHED: detalle público, editar, pausar, retirar.
- PAUSED: editar, reactivar si cumple requisitos, retirar.
- WITHDRAWN: registro propio de sólo lectura; sin edición ni reactivación.
- No existe SOLD para servicios.

Cupo: 20 no retirados; DRAFT/PUBLISHED/PAUSED consumen lugar, WITHDRAWN lo libera.
No hay límite histórico permanente. Filtro y paginación son de la RPC propia,
máximo 24 registros por página en UI. Confirmaciones explican pausa/retiro y la
respuesta remota se comprueba antes de mostrar estado actualizado.

Bloqueos y suspensión se muestran al dueño e impiden escrituras. La detección de
suspensión debe completar su lectura antes de mostrar el aviso (no se presenta
“suspendida” mientras todavía se consulta). Las guardas PostgreSQL protegen también
cambios administrativos posteriores a la carga.

## Detalles públicos, localidad y WhatsApp

El detalle del servicio y el perfil se revalidan al regresar a foco, al recuperar
conexión, al volver a la pestaña y cada cinco minutos cuando está visible.
Durante la comprobación se oculta la presentación/contacto; si falla, no se
conserva un WhatsApp potencialmente retirado y se ofrece reintentar.

El perfil consulta read_service_listings_page con providerId, localidad cubierta,
provincia y página. Propone la localidad del comprador sólo si coincide con
cobertura; si no, una de las localidades declaradas. Un select permite elegir otra.
Nunca busca nacionalmente ni usa la residencia como cobertura implícita.
Cada respuesta se identifica por prestador/localidad/provincia/página; una
respuesta anterior no se muestra bajo una localidad nueva.

WhatsApp usa argentinaWhatsAppUrl y sólo el número autorizado del DTO.
Detalle: “Consultar por WhatsApp” con mensaje sobre el título del servicio.
accepting_inquiries=false mantiene el servicio visible pero sin WhatsApp de ese
detalle. El perfil sólo muestra contacto si su DTO lo autoriza (puede existir otro
servicio que sí acepte consultas). Inactivo, suspendido, bloqueado, pausado o
retirado no se vuelve público por el frontend.

## Reportes

Reportar servicio y Reportar prestador, discretos y con inicio de sesión cuando
falta. Motivos exactos de serviceReportReasons, detalles hasta 1.000 caracteres,
confirmación y protección de doble envío. El backend reutiliza el reporte abierto
por usuario/objetivo y aplica sus restricciones. No se construyó panel Admin nuevo.
Errores amigables; no se muestran mensajes SQL, tokens ni datos administrativos.

## Inventario completo del Prompt 6

Rutas nuevas:
- src/app/publicar/servicio/page.tsx
- src/app/mi-perfil-profesional/page.tsx
- src/app/mis-servicios/page.tsx
- src/app/mis-servicios/[id]/page.tsx
- src/app/mis-servicios/[id]/editar/page.tsx
- src/app/servicio/[id]/page.tsx
- src/app/servicio/[id]/not-found.tsx
- src/app/prestador/[id]/page.tsx
- src/app/prestador/[id]/not-found.tsx

Componentes/hooks/estilos nuevos, bajo src/components/services/:
- service-auth-gate.tsx
- service-shell.tsx
- use-service-workspace.ts
- professional-profile.tsx
- service-areas-editor.tsx
- service-editor.tsx
- use-service-photo-draft.ts
- service-photos.tsx
- service-photo-cleanup.tsx
- use-signed-service-photos.ts
- service-presentation.tsx
- service-card.tsx
- my-services.tsx
- use-public-service-record.ts
- public-service.tsx
- public-provider.tsx
- service-report.tsx
- services.module.css

Nuevo: src/lib/services/frontend.ts y SERVICES_FRONTEND.md.
Archivos existentes ajustados para el Prompt 6:
- src/components/auth/account.tsx (accesos adicionales).
- src/components/personal-listings/publish-options.tsx (opción habilitada).
- src/components/personal-listings/publication-auth-gate.tsx (copy opcional para servicios).
- src/components/personal-listings/article-locality.tsx (ID de datalist por instancia).
- SERVICES_SETUP.md (estado confirmado por usuario y referencia al frontend).

Continuación tras el corte: se conservaron los anteriores y se completaron
service-editor.tsx (relectura incierta y creación explícita de otro),
public-provider.tsx (respuesta ligada a su ámbito),
use-service-photo-draft.ts (liberación al quitar fotos),
my-services.tsx (aviso de suspensión tras lectura), SERVICES_SETUP.md y esta guía.

## Pruebas manuales recomendadas (pendientes)

Usar cuentas y datos [QA] autorizados. No modificar registros reales innecesariamente.

1. Visitante → Publicar → Ofrecer servicio → login/registro → continuar en la ruta
   original. Probar logout/cambio de cuenta: no deben quedar datos de otro dueño.
2. Crear perfil [QA] con nombre/localidad/provincia, sin teléfono/cobertura/avatar.
   Guardar, recargar y comprobar un solo perfil. No debe copiar datos de Auth.
3. Completar número argentino y consentimiento; modificar número y comprobar que
   vuelve a pedir autorización. Guardar perfil.
4. Agregar Anisacate, Alta Gracia y otra localidad. Rechazar duplicado con espacios,
   mayúsculas/acentos distintos; quitar y guardar. Probar límite 30.
5. Avatar: subir, guardar, reemplazar, quitar y guardar. Probar archivo inválido,
   interrupción, recuperación temporal y limpieza explícita.
6. Primer servicio: título neutro, especialidad real, descripción, QUOTE y sin fotos.
   Guardar DRAFT, recargar y recuperar el mismo UUID. Llegar a previa y publicar.
   Confirmar NULL en precio si se inspecciona la respuesta RPC; nunca cero.
7. Otro servicio: FROM 15000 / FIXED 35000, decimales con coma/punto.
   Rechazar cero, negativos, tres decimales y separadores de miles.
8. Crear otro explícitamente dejando el anterior como borrador. Retirar uno y
   comprobar que el recordatorio de publicación no impide crear el siguiente.
9. Fotos: agregar cinco, reordenar/principal, quitar, guardar, recargar. Comprobar
   galería, reemplazo, temporales y ausencia de borrado de archivos vinculados.
10. Simular red interrumpida durante crear perfil, DRAFT, subida, registro de fotos
    y publish: conservar UUID, congelar, releer, recuperar; sin duplicados ni falso éxito.
11. Dos pestañas con misma revisión: guardar una y luego la otra. La segunda debe
    mostrar conflicto y exigir recarga, sin sobreescritura silenciosa.
12. Mis servicios: estados/filtros/paginación, publicar, pausar, reactivar y retirar.
    WITHDRAWN sólo lectura, sin SOLD. Probar cupo con 20 no retirados; retirar libera
    lugar. No hay tope histórico de 100.
13. Desactivar perfil con servicios publicados: detalle/perfil dejan de ser públicos.
    Reactivar conserva PAUSED/WITHDRAWN. Quitar toda cobertura/contacto de un activo
    con publicados debe respetar rechazo del backend y explicar cómo pausarlo.
14. Sin aceptar consultas: el servicio sigue visible, sin teléfono ni botón de
    WhatsApp en su detalle. Reactivar consultas lo restaura sólo si es elegible.
    Comprobar número +54/549 y mensaje con el título desde móvil y escritorio.
15. Perfil público: elegir localidades declaradas y comprobar que la RPC contiene
    providerId + localidad + provincia; sólo sus servicios PUBLISHED elegibles.
    Cambiar rápido localidad/página con red lenta: no mostrar resultados anteriores.
    Otra localidad no declarada no se inventa como cobertura.
16. Otra cuenta: no puede editar perfil/servicios/cobertura/fotos ajenos, tampoco por
    URL directa. Visitante sólo recibe DTO públicos. Probar UUID inválido/no público.
17. Bloqueo Admin de servicio/prestador y suspensión QA: negar escrituras y contacto
    público; desbloquear no reactiva retirados/pausados. No cambiar SQL para probarlo.
18. Reportar servicio/prestador desde otra cuenta, motivos y duplicado abierto;
    no autoreporte; probar límite/denegación y fallas de red con mensajes amigables.
19. Mantener fotos abiertas más de diez minutos, volver de segundo plano, reconectar:
    renovación/reintento sin persistir firmas. Una foto fallida no rompe la página.
20. Móvil/teclado: navegación, labels, foco, selects, galería, diálogos, botones anchos
    y textos largos. Confirmar que comercio, particulares y sus accesos siguen.
21. Para la integración posterior del Prompt 7 en Home, seguir ahora la guía
    SERVICES_SEARCH.md: cuarto dominio y consultas independientes de servicios.

## Limitaciones conocidas y siguiente etapa

- No se ejecutaron compilación ni QA: requieren la autorización/acción del usuario.
- Localidades conservan el contrato textual normalizado existente, no un padrón
  completo de ciudades ni equivalencias automáticas entre nombres alternativos.
- Sin conexión no se promete guardado offline: datos no confirmados requieren
  reconciliación. Si sessionStorage falla, los UUID sólo sobreviven en memoria;
  registros confirmados se recuperan desde las pantallas propias.
- Cambios administrativos se reflejan al reconsultar, no por Realtime instantáneo.
  Firmas ya emitidas conservan su TTL del backend.
- Prompt 7 conserva selección y página del perfil en URL durante la reconsulta
  pública; mantiene la revalidación de contacto y disponibilidad.
- El backend es quien autoriza todos los cambios, incluso con UI desactualizada.
- No hay SQL adicional pendiente ni nuevas dependencias. La integración del
  Prompt 7 está documentada en SERVICES_SEARCH.md.


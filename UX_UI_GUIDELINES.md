# CercaYa — sistema visual y navegación global

Etapa UX/UI 1. Marca: **CercaYa**. Lema: **Encontralo cerca. Tenelo hoy.**

## Alcance y auditoría de partida

Revisión por lectura de componentes, rutas, estilos y cambios existentes. No se ejecutaron navegador, servidores, tests, TypeScript, lint, build ni SQL. Los puntos visuales y de interacción de este documento requieren comprobación manual; no representan pruebas ejecutadas.

| Hallazgo | Decisión de esta etapa |
| --- | --- |
| Ya existe una base reconocible de verdes, fondos claros, botones y campos compartidos en `src/app/design-system.css`. | Reutilizar sus tokens y clases. No cambiar la marca ni aplicar un reset nuevo. |
| El Header, la barra móvil y PersonalShell ofrecían conjuntos de accesos diferentes. PersonalShell no incluía la barra inferior compartida. | Compartir Header y MobileNav también en los módulos de particulares, profesionales y solicitudes de servicios. |
| Los accesos a publicaciones, solicitudes, propuestas y gestión comercial estaban distribuidos entre menús distintos. | Agruparlos en Actividad, con títulos y explicaciones breves. |
| La barra inferior dedicaba dos posiciones a Pedidos y Guardados y no ofrecía Publicar. | Cinco entradas: Inicio, Buscar, Publicar, Actividad y Cuenta. Mantener los handlers de pedidos y guardados dentro de Actividad. |
| Un detalle podía marcar Inicio aunque no fuera la página inicial. | Resolver la sección activa según la ruta; la Home conserva su estado local de búsqueda/guardados. Las rutas desconocidas no fuerzan Inicio. |
| Los Radars necesitan contexto para personas nuevas. | Añadir descripciones de oportunidades comerciales y de servicios en la navegación, sin modificar sus pantallas. |
| Hay pestañas propias de cada módulo. | Conservarlas como navegación contextual. No crear otro selector de roles ni cambiar permisos. |
| Los flujos tienen feedback propio de carga, errores y vacíos, con presentaciones específicas de cada módulo. | Proveer primitivas comunes para futuras migraciones puntuales; no sustituir de golpe esos flujos ni inventar estados. |
| Hay componentes de retorno, diálogo, skeleton y verificación ya implementados. | Reutilizarlos y no crear equivalentes paralelos. |

Esta etapa no rediseña el contenido de Home, catálogo, detalles, formularios, panel comercial, Radars o propuestas. No cambia traducciones de enums en esos módulos ni su comportamiento.

## Identidad y tokens existentes

Fuente de verdad: `src/app/design-system.css`. Los nuevos componentes usan sus variables; las próximas pantallas deben hacer lo mismo.

| Uso | Token | Valor |
| --- | --- | --- |
| Marca y acción principal | `--green` | `#196747` |
| Marca profunda | `--deep` | `#124b35` |
| Color secundario | `--secondary` | `#456b60` |
| Acento suave | `--lime` / `--accent-ink` | `#d7ed9c` / `#28451d` |
| Fondo de página | `--paper` | `#f6f8f5` |
| Superficie | `--surface` | `#ffffff` |
| Superficie secundaria | `--surface-soft` | `#edf4ef` |
| Texto principal / secundario | `--ink` / `--muted` | `#192f27` / `#5c6d64` |
| Bordes | `--line` / `--line-strong` | `#dde6df` / `#b8cabe` |
| Éxito | `--success` / `--success-bg` | `#216143` / `#eaf5ed` |
| Atención | `--warning` / `--warning-bg` | `#805719` / `#fff6e5` |
| Error | `--error` / `--error-bg` | `#9c3b35` / `#fff0ee` |
| Información | `--info` / `--info-bg` | `#315e83` / `#edf4fa` |

No usar el verde lima para textos pequeños sobre blanco. Usar los colores de texto definidos para cada superficie. Los estados deben incluir una etiqueta; el color no es suficiente.

### Tipografía y jerarquía

- Mantener `Segoe UI, Arial, Helvetica, sans-serif`, sin nuevas descargas ni dependencias.
- Texto de lectura: `--text-base` (16 px), interlineado 1,5–1,65.
- Metadatos: `--text-sm` (14 px); etiquetas breves: `--text-xs` (13 px).
- Título de página: `--text-title` (28–40 px fluidos); un solo h1 por página.
- Sección: `--text-lg` (18 px), peso 700. Subtítulos del menú son más discretos para distinguir los grupos de los destinos.
- Pesos 600–700 para acciones y títulos. Evitar textos completos en mayúsculas, salvo etiquetas cortas existentes.
- Las etiquetas compactas de navegación admiten tamaño menor con área táctil amplia; no aplicar ese tamaño a formularios o contenido de lectura.

### Espaciado y superficies

- Escala existente: 4, 8, 12, 16, 24, 32, 48 y 64 px (`--space-1` a `--space-8`).
- Separar icono y texto con 8–12 px; elementos del mismo grupo con 8–16 px; grupos con 24–32 px.
- Radios: 8 px pequeño, 12 px controles, 18 px tarjetas/paneles, 26 px bloques destacados y pill para etiquetas.
- Usar `--shadow-sm` para acciones puntuales, `--shadow-card` para tarjetas que lo necesiten y `--shadow-floating` para paneles flotantes.
- Preferir borde sutil y blanco. No sumar sombras fuertes, degradados decorativos ni tarjetas dentro de tarjetas sin necesidad.
- Mantener `.shell` (máximo 1280 px) y sus márgenes responsive existentes.

## Componentes y reglas de uso

### Base existente que se conserva

- `.primary-button`, `.secondary-button`, `.outline-button`, `.ghost-button`, `.danger-button`: una sola familia de acciones. Alto habitual 48 px; variante pequeña 44 px. Los enlaces de navegación conservan su semántica de enlace.
- Inputs/select/textarea: mantener estilos y etiquetas de los formularios existentes; foco visible, `disabled`, `aria-invalid` y mensajes asociados. No se crea otro FormField equivalente en esta etapa.
- Tarjetas: `.panel`, bordes/radios compartidos y estilos propios del dominio cuando sean necesarios.
- `BackLink` / `BackButton`: conservar para retorno contextual. No reemplazar por un `history.back()` que pueda sacar al usuario del sitio.
- `Dialog`: conservar su mecanismo de apertura/cierre y su accesibilidad. No duplicar ConfirmationDialog.
- `ProductSkeletonGrid` y clases `.skeleton`: conservar para catálogos. No simular productos ni contadores durante la carga.
- `VerificationBadge`: conservar su significado y comprobación existente; no sustituir por una etiqueta genérica decorativa.

### Primitivas nuevas

`src/components/ui/primitives.tsx` y su CSS Module:

| Componente | Uso |
| --- | --- |
| `Button` | Adaptador tipado de las clases existentes. Admite primary/secondary/outline/ghost/danger y atributos nativos. Default `type="button"`; usar `type="submit"` explícito en formularios. |
| `SectionHeader` | Título h2/h3, descripción opcional, etiqueta y acciones. Se usa en los grupos de Actividad. |
| `StatusBadge` | Etiqueta con tono neutral/success/warning/error/info; el módulo decide el texto real. No conoce enums ni permisos. |
| `EmptyState` | Título, explicación y acciones opcionales, sin crear resultados falsos. |
| `ErrorState` | Mensaje accesible y reintento únicamente cuando se recibe un handler real. No mostrar SQL, claves ni errores internos. |
| `LoadingState` | Texto anunciado y skeleton decorativo. Usarlo sólo mientras exista una carga real. |

`NavigationItem` ofrece enlace con icono, título, descripción opcional y estado activo. No consulta datos ni aplica autorización.

Las primitivas de feedback quedan disponibles para las próximas etapas: no se migraron indiscriminadamente las pantallas existentes. No agregar wrappers alternativos para cada variante del mismo botón.

## Arquitectura de información

| Entrada global | Propósito |
| --- | --- |
| Inicio | Volver a la Home existente. |
| Buscar | Acceder al explorador actual utilizando los callbacks existentes donde ya estaban definidos. |
| Publicar | Abrir `/publicar`, el selector existente de formas de ofrecer. |
| Actividad | Consultar compras, solicitudes, publicaciones y oportunidades sin cambiar de cuenta. |
| Cuenta | Mantener el acceso actual a cuenta o inicio de sesión según la sesión existente. |

El carrito conserva su acceso y lógica actuales en el Header.

### Actividad

- **Mis compras y solicitudes:** Mis pedidos, Mis reservas, Mis solicitudes de servicios y Guardados.
- **Lo que ofrezco:** Mis publicaciones, Mis servicios, Mi comercio y Mi perfil profesional.
- **Encontrá oportunidades:** Radar comercial, Radar de servicios y Mis propuestas.
- **Necesito algo:** Necesito un producto y Necesito un servicio.
- Se conserva el acceso existente a Cómo funciona en el menú desktop y los enlaces informativos de las páginas.

Son accesos a rutas ya existentes. No se crea `/actividad`, no se fusionan dominios ni se amplían permisos. Los accesos protegidos siguen sujetos a sus guardas actuales. Las pestañas internas y la administración se conservan en sus contextos existentes.

Los handlers `onRequests`, `onSaved`, `onExplore`, `onAccount` y `onHow` se conservan donde ya se suministraban. La interfaz `MobileTab` permanece compatible con sus consumidores. No se inventan notificaciones ni contadores; Guardados continúa disponible dentro de Actividad y en los accesos existentes del catálogo.

### Desktop y tablet

- Header con marca y lema, ubicación actual, navegación, carrito y cuenta.
- Navegación superior con textos e iconos. Actividad abre un panel agrupado, con una sola profundidad.
- Debajo de 1100 px se permite una segunda fila para la navegación, evitando comprimir todos los controles.
- El panel tiene altura máxima y scroll propio para no perder accesos en ventanas bajas.
- Buscar conserva el comportamiento del contexto actual: en Home lleva al explorador; otros shells mantienen su callback existente. No se rehace el buscador.

### Móvil

- Hasta 600 px: cinco entradas inferiores, con texto e icono, sin sexta acción principal.
- Publicar queda siempre visible; Pedidos y Guardados pasan al grupo Actividad.
- Header compacto con carrito/cuenta y ubicación en su propia fila. La cuenta conserva etiqueta accesible aunque se oculte el nombre visual.
- Barra inferior con áreas cómodas (68 px de alto por elemento), cinco columnas flexibles y safe-area inferior/lateral.
- Se reutiliza el espacio inferior global ya reservado por `design-system.css`; no se duplica el padding.
- Actividad aparece encima de la barra, con altura limitada y scroll. No es un modal: no bloquea el resto de la página ni encierra el foco.
- Conservar las acciones locales y revisar manualmente que ningún footer sticky de un módulo se superponga a la barra global.

### Estado activo y retorno

`navigation-section.ts` sólo clasifica rutas para presentación. No autoriza, redirige ni cambia estados del dominio.

- Home usa el estado existente de Inicio/Buscar/Guardados para su indicación activa.
- Detalles públicos de productos/artículos/servicios/tiendas/prestadores pertenecen a Buscar.
- Publicar y crear una necesidad pertenecen a Publicar.
- Gestión, solicitudes, reservas y Radars pertenecen a Actividad.
- Cuenta y accesos de autenticación pertenecen a Cuenta.
- Rutas sin correspondencia no se marcan falsamente como Inicio.
- Mantener los enlaces contextuales de retorno y las URLs existentes.

## Accesibilidad e interacción

- Lucide sigue siendo la familia de iconos. Los iconos acompañados de texto son decorativos (`aria-hidden`).
- Objetivos táctiles mínimos de 44 px; no usar el tamaño del dibujo como tamaño del botón.
- Foco visible de 3 px con separación; hover suave usando `--duration` (180 ms) y `--ease` existentes.
- Se conserva la regla global de movimiento reducido.
- Navegación con landmarks y etiquetas; enlaces activos con `aria-current`.
- Actividad usa `details`/`summary` nativos: Enter/Espacio para abrir, Tab para recorrer. Escape cierra y devuelve foco al disparador; también hay botón Cerrar menú. Click fuera o navegación cierran el panel.
- No poner enlaces dentro de botones, no usar tarjetas clickeables sin semántica ni depender sólo del color.
- Los cambios de presentación no reemplazan la protección de rutas ni la verificación server-side.

## Lenguaje

- Español argentino: buscá, publicá, volvé, encontrá.
- Hablar de necesidades y acciones: comprar, ofrecer, seguir una solicitud, encontrar oportunidades.
- Evitar nombres técnicos en nuevas etiquetas. Los valores internos siguen intactos.
- En futuras pantallas, mostrar PENDING como “Esperando respuesta” y QUOTE como “A presupuestar” cuando corresponda al contexto; no reinterpretar estados ni contratos.
- No afirmar éxito si el módulo todavía está confirmando una operación remota.
- No mostrar estadísticas, reseñas, badges o notificaciones inventadas.

## Archivos de esta etapa

Creados:

- `UX_UI_GUIDELINES.md`
- `src/components/ui/primitives.tsx`
- `src/components/ui/primitives.module.css`
- `src/components/navigation/navigation-item.tsx`
- `src/components/navigation/activity-menu.tsx`
- `src/components/navigation/navigation-section.ts`
- `src/components/navigation/global-shell-navigation.tsx`
- `src/components/navigation/global-navigation.module.css`

Modificados:

- `src/components/home/header.tsx`
- `src/components/home/mobile-nav.tsx`
- `src/components/marketplace.tsx` (sólo indicación visual de sección activa en Header)
- `src/components/personal-listings/personal-shell.tsx` (integración del Header y barra móvil compartidos)

El working tree contiene además trabajo previo de CercaYa 2.0. No se atribuyen a esta etapa esos archivos ni se modificaron SQL, Auth, consultas, contratos o reglas de negocio.

## Revisión manual pendiente

1. Desktop 1440/1024 px y tablet 768 px: revisar filas del Header, ubicación larga, cuenta larga, carrito y panel de Actividad sin overflow.
2. Móvil 390 y 320 px: cinco acciones legibles, ubicación sin desbordes, panel scrollable, cierre y controles inferiores accesibles. Revisar landscape y safe-area en un teléfono.
3. Teclado: Tab, Shift+Tab, Enter/Espacio sobre Actividad, Escape, foco al cerrar y navegación por todos los destinos.
4. Lector de pantalla: nombres de ubicación/cuenta, navegación, estado activo, grupos y controles sin duplicación de iconos anunciados.
5. Abrir cada acceso de Actividad con sesión y sin sesión. Deben seguir actuando las protecciones existentes; no debe aparecer contenido privado antes de autenticar.
6. Home: Inicio/Buscar/Guardados conservan filtros y handlers existentes; Publicar abre el selector existente. Verificar el estado activo al cambiar de vista.
7. Probar un detalle comercial y uno particular, un servicio y un prestador: encabezado coherente, retorno contextual conservado y carrito accesible donde corresponde.
8. Abrir Mis publicaciones, Mis servicios, solicitudes y ambos Radars: conservar sus pestañas, formularios y acciones. Revisar especialmente formularios largos con la barra móvil fija.
9. Confirmar ubicación y cuenta mediante los diálogos/rutas existentes, y Cómo funciona mediante los accesos informativos existentes.
10. Revisar zoom 200 %, contraste, reducción de movimiento y textos largos. No considerar esta etapa visualmente validada hasta efectuar esta revisión.

## Siguiente prompt

Rediseño profundo de Home utilizando estos tokens y navegación. Mantener esta arquitectura, sin crear un segundo Header ni otra barra inferior. Migrar componentes de contenido y feedback de forma puntual cuando se trabaje cada pantalla. Los detalles, formularios, paneles y Radars quedan para sus etapas específicas.

## Ampliación UX/UI 3 — filtros y resultados compartidos

- Reutilizar SearchDomains, FilterPanel, ActiveFilters y SearchPagination de `src/components/search/search-controls.tsx` en el explorador.
- Los filtros se aplican al elegirlos; el panel es un fieldset visible y no añade un estado paralelo pendiente de aplicar.
- Limpiar filtros de un dominio conserva texto, contexto de ubicación y criterios de otros dominios. Las ubicaciones se cambian expresamente, no se eliminan con una categoría.
- Representar criterios removibles con chips que indiquen qué quitan. Mostrar el alcance geográfico como contexto separado.
- Cada dominio/grupo conserva total, carga, error y página independientes. No crear totales ni paginación globales sin contrato real.
- Usar enlaces de retorno validados al explorador para mantener sus parámetros. No aceptar destinos externos.
- Para resultados de servicios dentro de una sección h2, usar h3 en la tarjeta. Conservar componentes separados por dominio.
- Reglas y limitaciones de la etapa en `UX_UI_SEARCH.md`.

## Refinamiento compartido 3.1

- Preferir 14–16 px para descripciones, estados y metadata de resultados; reservar 13 px para etiquetas auxiliares compactas. Mantener títulos/precios jerárquicos y objetivos táctiles de al menos 44 px.
- Usar disclosures nativos para filtros secundarios; mantener principales, alcance y chips activos visibles. En Todo se pueden plegar los filtros de cada dominio; sus pestañas individuales conservan acceso completo.
- Un estado de stock, su fecha de confirmación y las opciones de retiro/envío son información distinta. No presentar datos declarados como garantía ni repetir el mismo estado en varias etiquetas.
- Una distancia calculada no implica precisión métrica: las cards reales usan una representación aproximada sin cambiar cálculos o filtros.


## UX/UI 6 — Actividad y Cuenta

- Actividad es el panel compartido de navegación hacia operaciones existentes; no se crea un dashboard o listado paralelo. Orden: Mis compras y pedidos, Trabajos que necesito, Lo que publico, Oportunidades y respuestas.
- Cuenta muestra datos propios, ubicación del navegador, configuración profesional/comercial y sesión. Los historiales se encuentran en Actividad. El acceso al mismo panel desde Cuenta evita duplicar su catálogo de enlaces.
- Reutilizar contextos autorizados ya cargados para personalizar. Sin dato fiable, utilizar acceso neutral; no consultar cada dominio para contar o decidir si existe actividad.
- Reservas no equivale a pago confirmado; solicitudes recibidas y propuestas enviadas son recorridos distintos. No inventar una bandeja comercial si no hay una ruta real para ella.
- El panel conserva Escape/cierre accesible, sólo una instancia abierta y foco en el disparador al cerrar. Los grupos plegables están dentro del mismo panel, sin menús flotantes anidados. No agregar otra barra fija móvil.
- Detalles, rutas auditadas, limitaciones y revisión manual en UX_UI_ACTIVITY_ACCOUNT.md. Esta etapa no rediseña los módulos internos.

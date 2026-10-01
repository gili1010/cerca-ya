# CercaYa · renovación visual

## Dirección

Un producto local, rápido y confiable. Verde profundo como identidad, fondos claros,
superficies blancas y acento lima acotado a la urgencia y la marca. El buscador
es la acción principal de Home; nombre, precio, distancia y stock tienen una
jerarquía clara. Radar conserva identidad propia dentro del mismo sistema.

La intervención es exclusivamente presentacional. No se cambiaron consultas,
RPC, contratos, validaciones, rutas, redirecciones, cálculos de distancia,
procesamiento de imágenes, persistencia, permisos ni lógica de Realtime.
En `use-live-changes.tsx` se modificó solamente el marcado de `LiveFeedback`
y su importación de iconos; sus hooks, suscripciones y temporizadores siguen iguales.
No se ejecutaron tests, lint, typecheck, build, navegador ni SQL.
La revisión del resultado renderizado queda pendiente de la revisión manual del usuario.

## Paleta y sistema compartido

| Uso | Color |
| --- | --- |
| Principal y acciones | `#196747` |
| Verde profundo, filtros activos y panel destacado | `#124B35` |
| Secundario | `#456B60` |
| Acento lima | `#D7ED9C` |
| Fondo | `#F6F8F5` |
| Superficie | `#FFFFFF` |
| Superficie suave | `#EDF4EF` |
| Borde | `#DDE6DF` |
| Texto principal | `#192F27` |
| Texto secundario | `#5C6D64` |
| Éxito | `#216143` sobre `#EAF5ED` |
| Advertencia / pendiente | `#805719` sobre `#FFF6E5` |
| Error / cancelación | `#9C3B35` sobre `#FFF0EE` |
| Información / lista / alternativa | `#315E83` sobre `#EDF4FA` |

`src/app/design-system.css` concentra colores semánticos, tamaños tipográficos,
espaciados, radios, sombras y transiciones de 180 ms. La tipografía usa Segoe UI
y fuentes del sistema, sin descargas ni dependencias nuevas. Los estilos de Home
siguen en `globals.css` y los de flujos en `workflows.css`, organizados por sección.
Se sustituyeron las reglas anteriores; no se agregó una capa de overrides al final.

Se unificaron botones primary, secondary, outline, ghost y danger; superficies,
badges, formularios, selección de opciones, carga, errores, estados vacíos y avisos.
La mayoría de controles usa 44–52 px de alto. Los inputs de formularios usan 16 px.
Se mantiene foco visible y se respeta `prefers-reduced-motion`.
Breakpoints principales: 600 px para móvil, 900 px para tablet y ajustes de
composición a 1100–1200 px. En pantallas muy estrechas, las cards pasan a una columna.
Los textos de estado permanecen visibles; no se depende solamente del color.
No se afirma una certificación WCAG: contraste, teclado, zoom y lectores de pantalla
requieren una revisión posterior del producto renderizado.

## Cambios por superficie

- **Home:** header equilibrado, buscador con foco del contenedor, hero con más
  jerarquía, ilustración existente refinada y bloque de promesa local verde profundo.
- **Categorías y filtros:** iconos de la librería existente, selección con contraste,
  targets cómodos y desplazamiento horizontal en móvil.
- **Productos:** imagen consistente, precio protagonista, confirmación legible,
  corazón de 44 px y comercio al pie; se conserva toda la información y enlaces.
- **Detalle:** disponibilidad con iconos y badges, ficha del comercio diferenciada,
  Reservar como acción principal y WhatsApp secundaria. Mismas condiciones y destinos.
- **Login / registro / cuenta:** presencia de marca, formularios de ancho acotado y
  accesos a la cuenta organizados como cards con iconos.
- **Comercio:** navegación y panel propios dentro del sistema, accesos con iconos y
  Radar destacado. No se agregaron métricas.
- **Pedido Abierto / ofertas:** formularios con secciones visibles, radios y
  espaciados compartidos; precios de ofertas y modalidades fáciles de comparar.
- **Radar:** encabezado y métricas con Lucide, cards de oportunidad diferenciadas,
  distancia y urgencia claras. Cálculos, filtrado y matching siguen iguales.
- **Reservas:** timeline horizontal en escritorio y vertical en móvil, marcas de
  etapas alcanzadas, estado actual destacado y acciones destructivas diferenciadas.
- **Cargas y avisos:** skeleton decorativo en la carga existente del catálogo,
  indicador en cargas de flujos y lenguaje visual compartido para avisos en vivo.
- **Navegación móvil:** icono activo sobre una superficie suave, estados pressed y
  espacio para safe-area. Se conservaron destinos y selección funcional de pestañas.

## Archivos

### Creados

- `src/app/design-system.css`
- `src/components/ui/product-skeleton-grid.tsx`
- `UI_REVIEW.md`

### Modificados

- `src/app/globals.css`
- `src/app/workflows.css`
- `src/components/home/product-card.tsx`
- `src/components/home/catalog.tsx`
- `src/components/details/public-product-detail.tsx`
- `src/components/auth/auth-form.tsx`
- `src/components/auth/account.tsx`
- `src/components/requests/request-shell.tsx`
- `src/components/requests/use-live-changes.tsx` — solo `LiveFeedback` e iconos.
- `src/components/radar/opportunity-card.tsx`
- `src/components/radar/radar.tsx` — solo marcado e iconos.
- `src/components/radar/merchant-workspace.tsx`
- `src/components/merchant-products/published-products-link.tsx` — icono presentacional.
- `src/components/reservations/reservation-common.tsx` — solo presentación de timeline.
- `src/components/reservations/reservation-detail.tsx` — clases y atributo visual de estado.

Los demás formularios y pantallas heredan el sistema sin modificar sus componentes.
`layout.tsx`, `src/lib`, `src/types`, `supabase` y archivos de configuración no se editaron.

## Mejoras que necesitan una tarea funcional separada

- **Miniaturas en Mis productos:** la consulta actual devuelve productos y categorías,
  sin `product_images`. Se conservó el placeholder; reemplazarlo por la foto real
  requeriría cambiar la consulta o el contrato de lectura.
- **Estados activos de navegación:** se mantuvo la selección funcional existente.
  Ajustar pestañas según cada ruta requiere revisar esa lógica; no se hizo aquí.
- **Demo y textos sobre el origen de datos:** los avisos que indican demo o Supabase
  se conservaron. Resolver sus inconsistencias requiere revisar cada flujo real/demo;
  un cambio de apariencia no debe ocultarlas ni presentar datos de prueba como reales.

## Checklist manual

Revisar en móvil (360–390 px), tablet y escritorio (1280 px o más). Usar también
teclado y zoom al 200 %. No hace falta modificar datos para revisar la composición;
si se prueban acciones de escritura, usar cuentas y publicaciones de prueba.

- [ ] **Home desktop:** header, hero, ilustración, buscador y cuatro cards por fila.
- [ ] **Home mobile:** categorías desplazables, precios legibles y bottom navigation sin tapar contenido.
- [ ] **Búsqueda:** selección de filtros, orden, carga, estado vacío y ausencia de scroll horizontal de la página.
- [ ] **Detalle de producto:** foto, stock confirmado/por confirmar/sin stock, comercio, Reservar y WhatsApp.
- [ ] **Login / registro:** ancho, labels, errores existentes, foco y botones deshabilitados durante envío.
- [ ] **Cuenta:** datos largos, cards de acceso y cerrar sesión.
- [ ] **Comercio:** panel, Mi comercio, crear/editar y navegación desplazable en móvil.
- [ ] **Productos:** listado, publicación, edición, foto, confirmación de stock y paginación.
- [ ] **Pedido Abierto:** formulario, ubicación opcional, Mis pedidos y detalle.
- [ ] **Radar:** métricas, filtros activos/deshabilitados, urgencia, distancia y sugerencias existentes.
- [ ] **Ofertas:** precio, comercio, retiro/envío, alternativa y detalle.
- [ ] **Reservas:** listado comprador/comercio, timeline, pendientes/listas y diálogo de cancelación.

Pendiente: revisión visual y funcional manual por el usuario. No se ejecutó una
sesión de navegador ni se confirmó el renderizado o la compilación durante esta tarea.

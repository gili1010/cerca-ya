# CercaYa 2.0 — QA 1A: experiencia pública real

Fecha: 19/10/2026. Entorno: Next.js dev local, http://localhost:3000, navegador integrado real. Este informe recupera la primera ejecución interrumpida y añade su continuación; no es una auditoría estática ni un build de producción.

## Resultados recuperados de la primera ejecución

| Pantalla / ruta | Móvil | Desktop | Estado del recorrido comprobado | Evidencia / observaciones | Pendientes |
| --- | --- | --- | --- | --- | --- |
| Home / | 390 y 430; controles públicos | 1440 | APROBADO para composición observada | Header, hero, descubrimiento, categorías, footer y navegación reales; sin overflow medido | Completar controles y matriz restante en continuación |
| Explorador /?view=search | 320/375/390/430 | 768/1440 | APROBADO para controles y vacíos observados | Todo, Comercios, Particulares, Servicios; filtros propios; búsqueda sin coincidencias y borrado | GPS comercial y paginación con suficientes registros |
| Artículo /articulo/c9673b4d-9364-4904-8362-6ec721a614ea | 390 | 1440 | APROBADO para recorrido observado | Torta, nuevo, $20.000, Alta Gracia, foto real, vendedor público; visor abre y Escape cierra; regreso conserva parámetros | Resto de anchos; galerías múltiples no disponibles |
| Servicio /servicio/1fc35f79-1dd5-4dc8-afc7-6bfe2cbd1016 | 390; medidas 320/375/430 | 1440; medidas 768 | PENDIENTE de cierre de corrección visual | Electricista, QUOTE/A presupuestar, cobertura y enlace autorizado. Sin foto: marco cuadrado vacío excesivo | Reconfirmar corrección y completar matriz |
| Perfil /prestador/a1371d4b-842b-4a5c-869b-fa65d56320db | 390 | 1440 | APROBADO para recorrido observado | Referencia distinta de cobertura; servicio propio real; selector cambia a Anisacate | Anchos secundarios y regreso con filtros |
| Tienda /tienda/lomos24hs-ag | 320/375/390/430 | 768/1440 | APROBADO | Cuatro productos reales, identidad, horarios, retiro/envío/pago acordado. Filtro pizza deja uno y limpiar restaura cuatro | No repetir; faltan otros tipos de fotos reales |
| Catálogo comercial de la tienda | 320/375/390/430 | 768/1440 | APROBADO para las cuatro fotos disponibles | Marcos 300×224 px desktop; 164×122 px a 390; sin deformación ni alturas dinámicas. Lomito original 148×148, baja nitidez de origen | Flyers verticales y producto sin imagen no disponibles |
| Producto /producto/7c632ddf-ac3b-4e02-945e-47abb29e85f5 | 320/375/390/430 | 768/1440 | APROBADO | Pizza especial, $15.000, ON_DEMAND, retiro/envío, tienda. Visor abre/cierra y Escape funciona. Sin agregar al pedido | No repetir salvo regresión |
| Publicar /publicar | 430 | — | APROBADO sólo acceso de navegación | Selector real de ofrecer/necesitar, sin completar formularios | Fuera de alcance probar publicación |

Las aprobaciones anteriores se limitan a lo efectivamente abierto y observado; no implican validación de backend, todas las variantes, contraste instrumentado o todos los navegadores.

## Incidencias y límites ya comprobados

- GPS comercial: TIMEOUT visible y comprensible, permite reintentar. No hay alternativa manual comercial en el modal observado. La localidad manual del hero funciona para particulares/servicios y explica que no cambia el alcance comercial. No se inventaron coordenadas ni distancias. Catálogo comercial en Home con GPS queda BLOQUEADO por el entorno; la tienda se comprobó por URL proporcionada por el usuario.
- Servicio sin fotografías: el marco cuadrado generaba un bloque blanco de unos 650 px en escritorio. Se añadió data-empty sólo cuando photos.length === 0 y regla CSS de altura mínima 160 px, sin cambiar galerías con fotos ni el catálogo. Medición remota posterior: 160 px; captura móvil de la corrección pendiente de guardar tras un timeout de la herramienta.
- No aparecieron errores/warnings en las lecturas de consola realizadas en la primera ejecución. Esto no equivale a asegurar ausencia universal de errores de red; no se instrumentaron llamadas privadas ni se accedió a tokens.
- La pantalla inicial Sin conexión se debió al acceso inicial al proceso local; se recuperó el servidor existente y continuó la navegación. No se cambiaron variables de entorno ni credenciales.
- Hubo una demora de la herramienta de capturas; servicio-mobile-corregido.jpg quedó vacío (0 bytes). No se considera evidencia válida. Algunas capturas tomadas inmediatamente tras cambiar viewport quedaron desfasadas; se priorizan los archivos representativos confirmados y no se usan para afirmar revisiones adicionales.

## Evidencia previa conservada

Carpeta externa al repositorio:
C:/Users/lucia/.codex/visualizations/2026/09/27/01a0e41f-8531-7092-a43b-c1614be195f2/qa-1a/

Archivos representativos: articulo-desktop.jpg, articulo-mobile.jpg, buscador-320.jpg, buscador-desktop.jpg, buscador-vacio-mobile.jpg, catalogo-comercial-desktop.jpg, catalogo-comercial-mobile.jpg, home-desktop.jpg, home-mobile.jpg, perfil-desktop.jpg, perfil-mobile.jpg, producto-desktop.jpg, producto-mobile.jpg, servicio-desktop.jpg, servicio-mobile.jpg, tienda-desktop.jpg, tienda-mobile.jpg.

## Cambios de código recuperados

- src/components/details/detail-gallery.tsx: atributo data-empty de presentación.
- src/components/details/public-details.module.css: marco compacto sólo sin fotografías.

No se modificaron datos comerciales, RPC, SQL, RLS, Auth, Storage, reglas de stock o consultas. No se crearon reservas, publicaciones, propuestas ni mensajes. Las búsquedas normales pueden generar la analítica que ya tiene la app; no se agregó instrumentación.

## Continuación

Continuación terminada para los recorridos ejecutables. Los resultados históricos de arriba se conservan; el cierre consolidado siguiente actualiza pendientes y límites sin convertirlos en aprobaciones ficticias.


## Comprobaciones nuevas de la continuación

- Se reutilizó la pestaña abierta del servicio y el servidor local, sin reiniciar la auditoría ni repetir la tienda, sus cuatro fotos o el visor comercial ya aprobados.
- Se guardaron capturas válidas del servicio corregido a 390 y 1440 px; se volvió a comprobar a 320 y 768 px. El placeholder mide 160 px, sin overflow. También se cerró el retest visual a 375/430 px al final de la continuación. Las fotografías existentes conservan el marco anterior.
- Home: se completó la inspección del encabezado/hero a 320, 375, 430 y 768 px. Se completó el footer en 390/1440 px: enlaces y copyright quedan alcanzables por scroll, con separación respecto de la barra móvil.
- Categorías: Ver todas abre las restantes, Gastronomía lleva a búsqueda y muestra el filtro correspondiente. No se cambia taxonomía ni lógica.
- Particulares: se aplicó localidad Alta Gracia/Córdoba, categoría Gastronomía, condición Nuevo y orden Precio menor a mayor. Apareció el artículo real Torta. Chips y selector coincidieron; no se mezclaron controles de stock/servicios.
- Detalle particular: anchos secundarios 320/375/430/768 sin overflow medido ni deformación de la foto real. Desde Volver a resultados se recuperaron dominio, categoría, condición, orden, localidad y ancla #particulares.
- Servicios: se eligió especialidad Electricidad y texto electricista. El resultado real apareció con A presupuestar. Desde el servicio se volvió a resultados conservando q, especialidad, localidad y dominio. Los parámetros inactivos de particulares/comercios permanecieron en la URL sin mostrarse como filtros profesionales.
- Perfil profesional: se completaron 320/375/430/768 px; nombre largo, presentación, referencia y chips de cobertura se adaptaron sin overflow. El retorno desde el perfil también preservó la búsqueda de servicios y especialidad. El cambio a Anisacate ya estaba probado y no se repitió.
- Navegación: Actividad abre/cierra por Escape en móvil (primera ejecución) y desktop (continuación), devolviendo el foco al disparador según estado observado. Inicio se verificó con Enter, Cuenta abrió /cuenta y se volvió sin editar ni cerrar sesión. Publicar ya había abierto su selector; no se repitió el formulario.
- Consola: nuevas lecturas de warnings/errors devolvieron lista vacía. No se observaron excepciones JavaScript, errores de hidratación o imágenes rotas en estos recorridos. Las comprobaciones de imágenes se realizaron sobre los elementos DOM renderizados, no mediante acceso a Storage.

## Incidencias clasificadas

| ID | Tipo | Hallazgo real | Resolución / estado |
| --- | --- | --- | --- |
| V-01 | A. Visual | Servicio sin fotos mostraba un gran marco blanco cuadrado | CORREGIDO: data-empty + placeholder de 160 px. Reabierto y comprobado en 390/1440, también 320/375/430/768. |
| ENV-01 | D. Entorno / geolocalización | GPS comercial agotó tiempo; error visible y reintento disponible | BLOQUEADO sólo el catálogo geográfico de Home y filtros que requieren coordenadas. No se repitió GPS ni se inventó ubicación. Tienda/producto real ya aprobados por ruta pública. |
| DEV-01 | C. Advertencia de desarrollo | Indicador Next.js en esquina inferior izquierda se superpone a Inicio móvil; click abrió Dev Tools | Registrado; Escape cierra y Enter sobre Inicio navega correctamente. No se cambió Next config ni se movió la navegación del producto para compensar un control de desarrollo. Verificar ausencia en producción cuando se autorice ese QA. |
| COPY-01 | C. Menor | Conteo profesional muestra “1 servicios” / “1 localidades más” en algunos textos | Registrado, sin impacto en filtros o navegación; no se amplió esta corrección visual a múltiples módulos de copy. |

No se detectó un fallo de backend nuevo confirmado. El timeout GPS se mantiene separado de los resultados públicos disponibles. No se analizó exhaustivamente elegibilidad, analítica o búsqueda semántica: eso corresponde a QA 2.

## Cierre consolidado por pantalla

| Pantalla | Móvil / anchos comprobados | Desktop / tablet | Estado final del recorrido observado | Corrección | Pendiente específico |
| --- | --- | --- | --- | --- | --- |
| Home y descubrimiento | 320/375/390/430 | 768/1440 | APROBADO en estructura y controles públicos observados | Ninguna | Resultados comerciales de Home con GPS BLOQUEADOS |
| Buscador / Todo | 320/375/390/430 | 768/1440 | APROBADO para tabs, grupos y vacíos observados | Ninguna | Paginación con datos suficientes; grupo comercial con GPS |
| Buscador / Comercios | 390 y estructura general en otros anchos | 768/1440 | APROBADO para controles; BLOQUEADO para resultados por distancia | Ninguna | GPS; Con envío/radio/orden de cercanía con ubicación real |
| Buscador / Particulares | 390; ancho común de buscador revisado en secundarios | 768/1440 | APROBADO | Ninguna | Más de una página y variantes no presentes |
| Buscador / Servicios | 390; ancho común de buscador revisado en secundarios | 768/1440 | APROBADO | Ninguna | Más de una página, FIXED/FROM reales |
| Detalle particular Torta | 320/375/390/430 | 768/1440 | APROBADO | Ninguna | Galería múltiple, usado y vendedor con otros datos reales |
| Detalle servicio Electricista | 320/375/390/430 | 768/1440 | CORREGIDO | Placeholder sin fotos compacto | Servicio con fotos no disponible |
| Perfil profesional | 320/375/390/430 | 768/1440 | APROBADO | Ninguna | Avatar real y muchos servicios/coberturas no presentes |
| Tienda /tienda/lomos24hs-ag | 320/375/390/430, primera ejecución | 768/1440, primera ejecución | APROBADO, conservado | Ninguna | Variantes fotográficas adicionales |
| Producto Pizza especial y visor | 320/375/390/430, primera ejecución | 768/1440, primera ejecución | APROBADO, conservado | Ninguna | Flyer vertical y producto sin foto reales |
| Footer y navegación global | 390, controles adaptados en anchos secundarios | 1440, Header 768 | APROBADO para recorridos comprobados, con advertencia DEV-01 | Ninguna | Producción sin indicador dev; no se probó todo destino legal ni cada opción de Actividad |
| Galerías múltiples / flyer / sin foto comercial | — | — | NO PROBADO por falta de datos accesibles | Ninguna | Requiere publicaciones reales existentes, no fixtures |
| Paginación con suficientes registros | — | — | NO PROBADO | Ninguna | Sólo 1 particular, 1 servicio y 4 productos en el conjunto observado |

Los anchos secundarios se usaron para una revisión breve de overflow, imagen, jerarquía y controles visibles. No se presentan como recorridos completos de cada estado de cada pantalla. Las mediciones de scrollWidth resultaron menores o iguales a innerWidth en los casos registrados; eso complementa, no sustituye, las capturas y navegación real.

## Evidencia nueva y persistencia

En la misma carpeta externa qa-1a se añadieron:
- servicio-mobile-corregido.jpg (reemplaza el archivo de 0 bytes; ahora válido).
- servicio-desktop-corregido.jpg.
- home-320-continuacion.jpg.
- particulares-filtros-mobile.jpg.
- servicios-filtros-desktop.jpg.
- footer-mobile-continuacion.jpg.
- footer-desktop-continuacion.jpg.
- mediciones-continuacion.json (sólo mediciones DOM de interfaz pública).
- consola-continuacion.json (lectura warnings/errors; lista vacía en ese momento).

home-desktop-continuacion.jpg quedó en un punto intermedio del scroll y no se utiliza como evidencia del hero. servicio-320.jpg, servicio-768.jpg y servicio-1440.jpg de la ejecución inicial tienen desfase de captura tras resize: quedan conservados pero excluidos de evidencia concluyente. No se añadieron binarios al repositorio. Las capturas de página completa anteriores pueden representar la barra fija en medio de la imagen; la comprobación de superposición se hizo sobre viewport/scroll real, no infiriendo un fallo a partir del stitching.

## Archivos y restricciones

En esta continuación se creó QA_VISUAL_PUBLIC.md y se completó la evidencia externa. Se conservaron los únicos cambios de código de QA 1A, realizados antes del corte:
1. src/components/details/detail-gallery.tsx.
2. src/components/details/public-details.module.css.

No se agregaron otras correcciones de código. No se ejecutaron tests, lint, TypeScript, build de producción, SQL ni despliegues. No se iniciaron QA 1B, QA 1C o QA 2. No se tocaron datos reales, Auth, Supabase, reglas comerciales, reservas o contactos. Se restauró el viewport del navegador al terminar y se reutilizó el servidor local existente.

## Conclusión

QA 1A tiene cerrado el recorrido ejecutable de las pantallas públicas y documentado el ajuste visual reproducido. No puede declararse cobertura completamente terminada al 100 %: quedan el catálogo de Home con GPS (BLOQUEADO), variantes fotográficas/precios/galerías y paginación sin datos suficientes (NO PROBADO). No se repite lo ya aprobado ni se fabrican datos para completar la matriz.

Para cerrar esos límites: probar GPS con permiso en un dispositivo que lo resuelva y aportar URLs de publicaciones existentes con flyer vertical, sin foto comercial, galería múltiple, precio fijo/desde y suficiente volumen para paginar. QA 2 debe tratar las reglas funcionales por separado cuando se autorice.

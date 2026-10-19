# CercaYa — UX/UI 6: Mi actividad y Mi cuenta

## Alcance y método

Continuación del working tree de UX/UI 4 y 5, conservando sus archivos. Revisión por lectura de git status/diff, documentación UX_UI_GUIDELINES, UX_UI_HOME, UX_UI_SEARCH, UX_UI_DETAILS, UX_UI_PUBLISH y SERVICE_RADAR_FRONTEND, y guía instalada de Next sobre componentes Server/Client.

No se ejecutaron tests, lint, TypeScript, build, navegador, servidores, SQL ni despliegues. No se instalaron dependencias. Las conclusiones son de código, no PASS de funcionamiento o diseño verificado en ejecución.

## Auditoría inicial

| Componente / ruta | Situación anterior | Decisión |
| --- | --- | --- |
| Header / MobileNav | Ya comparten ActivityMenu y conservan callbacks para buscar/pedidos/guardados. | Mantener esos consumidores y handlers. |
| ActivityMenu | Menú único de muchas filas; agrupaba solicitudes de trabajo junto a compras y repetía acciones de Publicar. | Cuatro grupos por objetivo, dos plegables y un acceso a Publicar. |
| /cuenta — Account | Mezclaba perfil y sesión con casi todos los historiales, publicaciones y Radars. | Quitar duplicación; datos propios, ubicación, configuración y sesión. |
| DetailShell / PersonalShell / RequestShell / ServiceShell / RadarFrame | Los módulos tienen shells propios y navegación global. | No crear shells, dashboard, listados ni rutas paralelas. |
| BusinessProvider | Ya carga comercio propio y expone loading/error. | Reutilizar el contexto para personalizar sin nuevas consultas. |
| Perfiles profesionales, artículos, solicitudes y propuestas | No hay un resumen autorizado global barato disponible en el contexto actual. | Accesos neutrales, sin consultar cada dominio y sin afirmar vacío. |
| Reservas /reservas | Pedidos comerciales con estados; no acredita pago. | Nombrar como reservas e historial de pedidos, sin compra pagada inventada. |
| Pedidos /pedidos | Solicitudes de productos y ofertas recibidas, diferente de reservas. | Descripción explícita Mis pedidos de productos. |
| Radar comercial | Ruta real /comercio/radar; /comercio/oportunidades sólo redirige allí. | Usar la ruta real. |
| Ofertas comerciales | Existe detalle /comercio/oferta-enviada/[id], no una bandeja independiente de todas las ofertas. | No inventar ruta Mis ofertas ni datos/IDs. Mantener acceso desde recorridos reales. |
| DemoProvider setModal(account) | Navega a /cuenta o /login; no abre realmente HomeDialogs(account). | Mantener el mecanismo, usando loginUrl('/cuenta') para conservar regreso seguro cuando no hay sesión. |

Rutas especializadas auditadas: /reservas, /reserva/[id], /pedidos, /pedido/[id], /mis-publicaciones, /mis-servicios, /mi-perfil-profesional, /mis-solicitudes-servicio, /solicitud-servicio/[id], /mis-propuestas-servicio, /radar-servicios, /comercio, /comercio/mi-negocio, /comercio/productos, /comercio/reservas y /comercio/radar. Sus pantallas y consultas se conservan.

## Elección de arquitectura: conservar un solo panel

Actividad continúa siendo el panel global existente, abierto desde desktop o MobileNav. No se crea /actividad ni un dashboard alternativo. El panel tiene título Mi actividad y subtítulo Encontrá tus publicaciones, pedidos y oportunidades.

Cuenta incorpora Ver mi actividad reutilizando exactamente ActivityMenu, sin otra lista de actividades. Sólo una instancia del panel puede permanecer abierta. Los grupos plegables son disclosures dentro de la misma superficie; no abren popups anidados. La navegación especializada sigue siendo responsable de mostrar historiales y administrar cada módulo.

## Grupos y rutas

### Mis compras y pedidos

- Mis reservas → /reservas: estado e historial de pedidos a comercios.
- Mis pedidos de productos → /pedidos: necesidades publicadas y ofertas recibidas.
- Guardados → /guardados o callback preexistente cuando el consumidor lo suministra.

### Trabajos que necesito

- Mis solicitudes de servicios → /mis-solicitudes-servicio: cada detalle existente permite ver las propuestas recibidas. No se crea otra bandeja.

### Lo que publico

Grupo plegable, abierto inicialmente si la ruta actual pertenece a él:
- Mis publicaciones → /mis-publicaciones: artículos particulares, sin confundir con catálogo comercial.
- Mis servicios → /mis-servicios: administrar o empezar a ofrecer trabajos.
- Mi comercio → /comercio cuando existe o su estado no es fiable; Crear mi tienda → /comercio/crear sólo si la lectura global confirmó ausencia.
- Productos de mi comercio → /comercio/productos y Reservas de mi comercio → /comercio/reservas sólo cuando hay comercio conocido.

### Oportunidades y respuestas

Grupo plegable:
- Radar de servicios → /radar-servicios: oportunidades profesionales en cobertura.
- Mis propuestas enviadas → /mis-propuestas-servicio: respuestas profesionales propias.
- Radar comercial → /comercio/radar: necesidades de productos y acceso a las ofertas que ofrece ese módulo. Sin comercio conocido se aclara el requisito, sin ocultar el acceso para comenzar.

Publicar algo nuevo abre /publicar existente. Mi cuenta abre /cuenta, excepto dentro de esa misma página, donde se omite el enlace redundante. No se agregan accesos Admin, contadores ni estados internos.

## Mi cuenta

Página existente /cuenta, con requireUser/RequireAuth sin cambios:

- Identidad/nombre disponible y datos personales propios: nombre, email de cuenta y teléfono guardado. Errores de perfil distinguen indisponibilidad de ausencia y mantienen reintento.
- Se aclara que el teléfono del perfil no equivale a autorizar contacto público en artículos o servicios.
- Ubicación para explorar reutiliza BuyerLocationControls: actualizar/quitar ubicación con los handlers existentes. No se muestra latitude/longitude. Se explica que se recuerda en este navegador, sin prometer sincronización de cuenta.
- Perfil profesional y comercio es un bloque plegable de configuración: /mi-perfil-profesional para presentación/contacto/cobertura; /comercio/mi-negocio para datos del comercio confirmado, o /comercio/crear si la consulta confirmó ausencia. Loading/error/retry se conservan.
- Tu sesión conserva exactamente signOut con scope local, manejo de errores y salida a Home.

No se agregan botones para editar nombre/email/teléfono: esta pantalla no tenía esa funcionalidad. No se inventan preferencias, suscripciones, reputación ni verificación. Perfil profesional está en Cuenta como configuración; Mis servicios está en Actividad como administración de publicaciones. Comercio puede aparecer en ambos con propósito distinto: operación en Actividad y configuración en Cuenta.

## Autenticados, visitantes y seguridad

El panel usa useAuth existente: mientras carga muestra comprobación; sin usuario muestra Ingresá para ver tu actividad, login y registro con regreso a /cuenta. No presenta grupos privados, nombres de comercio ni datos de actividad a visitantes. Después de entrar, Cuenta ofrece el mismo panel para continuar. No se afirma conocer actividades previas sin leerlas.

Cuenta conserva la protección SSR y cliente. Su acceso global sin sesión ahora usa el helper seguro ya importado loginUrl('/cuenta'), sin modificar autenticación, sesiones, OAuth ni callbacks. Explorar públicamente sigue permitido. Logout no cambia.

Los contextos ya autorizados son la única fuente de personalización. No se exponen tokens, IDs de Auth, datos de otros usuarios, notas de moderación, estado privado de suspensión, coordenadas ni teléfonos de terceros. La ubicación se controla únicamente por las acciones existentes del propietario del navegador.

## Estados vacíos y rendimiento

No se consulta la existencia de artículos, servicios, solicitudes o propuestas para mostrar ceros o mensajes de todavía no tenés. Esos estados siguen siendo responsabilidad de cada pantalla, con sus datos autorizados. Mi servicios conserva acceso incluso sin saber si existe perfil, sin obligar a crear comercio ni rol.

No se crean consultas, suscripciones Realtime, polling, RPC ni cachés. ActivityMenu lee useMyBusiness/useAuth ya provistos globalmente; no crea otro BusinessProvider ni carga listas. Account reutiliza los mismos proveedores. Los reintentos explícitos de perfil/comercio y ubicación siguen utilizando las acciones actuales.

## Navegación, responsive y foco

Se conservan destinos y parámetros especializados. Cada módulo mantiene sus enlaces de volver al listado/edición; Actividad permanece accesible desde la navegación global para retomar otro recorrido. No se usa history.back, un redirect externo o un parámetro de retorno nuevo.

En móvil se mantienen cinco entradas inferiores. Panel fijo sobre MobileNav, separado de safe-area, altura limitada y scroll vertical propio; títulos de 14 px, filas de al menos 60 px y cierre de 44 px. Escape y ambos cierres devuelven foco al summary. Click fuera, cambio de ruta/cuenta y Tab hacia fuera cierran el panel. No es un modal ni atrapa foco. Al abrir una instancia cierra las otras para evitar superposición entre Header, MobileNav y Cuenta.

Desktop usa el mismo panel de hasta 560 px. Cuenta distribuye datos y configuración/sesión en dos columnas hasta su máximo de 1040 px, pasando a una bajo 800 px. Móvil compacta padding y apila el acceso a Actividad. La ubicación reutiliza botones cómodos. No se agrega una barra sticky ni se duplica el padding inferior global.

NavigationItem mantiene enlaces reales y agrega una flecha decorativa. Estado activo conserva aria-current y recibe borde además de color. Summary nativos, jerarquía h2/h3 en el panel, labels, iconos decorativos, foco visible, texto que envuelve y movimiento reducido global. No se cambian las reglas de navegación activa existentes.

## Archivos de esta etapa

Creados:
- src/components/auth/account.module.css
- UX_UI_ACTIVITY_ACCOUNT.md

Modificados:
- src/components/auth/account.tsx
- src/components/navigation/activity-menu.tsx
- src/components/navigation/navigation-item.tsx
- src/components/navigation/global-navigation.module.css
- src/components/demo-provider.tsx (únicamente destino seguro de regreso a Cuenta)
- UX_UI_GUIDELINES.md (separación y uso compartido del panel)

Los archivos de UX/UI 4 y 5 ya presentes en el working tree se conservan y no se atribuyen a este cambio. No se modifican rutas/pages, módulos internos de gestión ni backend.

## Limitaciones

- No hay una página independiente Mi actividad; se eligió conservar el panel existente para evitar dos centros de navegación.
- Sin resumen global de perfil profesional/artículos/solicitudes no se personalizan esos nombres por existencia ni se presentan vacíos o contadores.
- No existe una bandeja independiente de ofertas comerciales. Los detalles con ID y sus accesos actuales no permiten inventar un listado completo seguro; queda documentado, sin nuevas consultas ni rutas.
- El ingreso desde Actividad vuelve a Cuenta y permite reabrir el panel; no se conserva automáticamente el estado abierto después de autenticar.
- Los estilos y el manejo de foco requieren prueba real en navegador y móvil. No se declara aprobación de compilación ni QA visual.
- Los listados y paneles de gestión conservan su presentación actual; UX/UI 7 y 8 no se iniciaron.

## Pruebas manuales pendientes

1. Visitante en Home: abrir Actividad desde Header y MobileNav. Debe mostrar login/registro, nunca datos privados. Confirmar regreso a Cuenta y exploración pública sin sesión.
2. Cuenta compradora QA sin comercio: reservas y solicitudes claras; los bloques de ofrecer/oportunidades son plegables y no simulan actividad inexistente. Crear tienda permanece disponible.
3. Comerciante QA: comprobar nombre real, productos, reservas del comercio, panel, configuración y Radar. No confundir /reservas del comprador con /comercio/reservas.
4. Profesional QA: Mis servicios, solicitudes propias, Radar profesional y propuestas enviadas. Perfil/contacto/cobertura desde Cuenta. No exigir cambio de rol.
5. Verificar Pedidos y Guardados en Home y otros shells: los callbacks anteriores deben conservar filtros/comportamiento y los enlaces deben abrir sus pantallas existentes.
6. Abrir grupos con Enter/Espacio; Tab/Shift+Tab; Escape; cierre superior/inferior y click fuera. Confirmar foco en disparador y una sola instancia abierta, incluido Ver mi actividad en Cuenta.
7. Desde listado abrir y editar un servicio/artículo, regresar al listado y abrir Actividad; mantener parámetros y borradores. No cambiar datos reales para esta revisión visual.
8. Cuenta: nombre largo, email largo, teléfono ausente, error/carga de perfil/comercio y reintentos. No mostrar ausencia de comercio mientras todavía carga o falló.
9. Ubicación: comprobar lectura del estado existente, actualizar sólo al pedirlo y quitar mediante acción explícita; sin coordenadas visibles ni promesa de guardado entre dispositivos.
10. Logout desde Cuenta: carga, error de red y salida correcta; volver atrás/cambiar cuenta sin mostrar datos del anterior.
11. 320/375/390/430/768/1024/1440 px, landscape y zoom 200 %: sin overflow, panel visible sobre barra móvil, scroll, títulos largos y cierre accesible.
12. Revisar Home, Publicar, detalles UX/UI 4 y formularios UX/UI 5 como regresión visual; sin ejecutar pagos, SQL o acciones de moderación innecesarias.

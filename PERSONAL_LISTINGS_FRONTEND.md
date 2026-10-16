# CercaYa 2.0 — frontend de publicaciones particulares

Actualización Prompt 4: los particulares ya se integran a Home/explorador.
Ver [PERSONAL_LISTINGS_SEARCH.md](PERSONAL_LISTINGS_SEARCH.md) para filtros,
ubicación, paginación, retorno al detalle y pruebas manuales de esa etapa.
Las referencias a “buscador pendiente” siguientes describen el cierre histórico
del Prompt 3; servicios sigue pendiente.

El usuario confirmó la ejecución correcta de `personal-listings.sql`,
`personal-listings-access.sql` y `community-moderation.sql`. Esta etapa utiliza
ese backend. No agrega SQL ni modifica los deltas aplicados.

## Rutas y acceso

| Ruta | Función |
| --- | --- |
| `/publicar` | Vender un producto / Servicios próximamente / Crear mi tienda. |
| `/publicar/articulo` | Alta guiada y recuperación del borrador iniciado en esta sesión. |
| `/mis-publicaciones` | Listado propio paginado, filtro por estado y administración. |
| `/mis-publicaciones/[id]` | Vista privada del propietario, incluidos borradores y retirados. |
| `/mis-publicaciones/[id]/editar` | Edición con revisión, fotos y contacto autorizado. |
| `/articulo/[id]` | Detalle público sin perfil privado, owner_id ni datos de moderación. |

Acceso desde “Publicar” en el Header (desktop y una fila propia en móvil),
“Mi cuenta” y navegación del módulo. “Mis publicaciones” también tiene acceso
directo en móvil y Mi cuenta. La navegación inferior existente no se reemplaza.

Los visitantes pueden ver `/publicar` y artículos publicados. Para publicar o
administrar ven una invitación a iniciar sesión/registrarse, conservando la ruta
de destino mediante Auth existente. No se requiere comercio ni MerchantBusinessGate.

## Cómo publicar

1. Elegir **Vender un producto**.
2. Completar título, descripción, categoría real de Supabase, Nuevo/Usado, precio
   ARS y precio negociable. Elegir provincia y localidad, sin domicilio ni GPS.
   La búsqueda opcional de sugerencias reutiliza Geoapify existente; si falla,
   puede escribirse el nombre completo según el contrato textual actual.
3. Al continuar se crea un **DRAFT** antes de cualquier subida.
4. Seleccionar 1..5 fotos. Se comprimen, previsualizan y pueden eliminarse,
   moverse con flechas o pasar a principal con la estrella.
5. Continuar guarda las versiones en el bucket privado y registra su orden por RPC.
6. Escribir nombre público opcional y WhatsApp argentino. Autorizar expresamente
   su publicación; cambiar el teléfono desmarca el consentimiento.
7. Revisar la vista previa. **Volver a editar** regresa a los datos.
8. **Publicar artículo** confirma estado PUBLISHED en backend y muestra éxito
   con acceso al detalle público.

“Guardar borrador” permite salir antes de completar fotos/contacto, siempre que
los datos mínimos y localidad sean válidos. Un teléfono sin consentimiento no
se guarda en el anuncio; no se utilizan datos privados del perfil.

No agregar puntos de miles al precio; admite coma o punto decimal. La moneda
siempre es ARS. Las categorías vienen de la tabla existente, sin mocks.

## Revisiones, recuperaciones y fotos

- Cada operación espera su respuesta y recupera la revisión antes de la siguiente.
- No se toma una revisión nueva para sobrescribir un formulario viejo después de
  un conflicto. El formulario se bloquea y pide **Recargar publicación**.
- Recargar reemplaza cambios locales por el estado guardado. El aviso lo explica.
- Un lock inmediato evita doble clic durante preparación/subida/guardado/publicación.
- El intento de alta conserva un UUID en memoria y en sessionStorage por cuenta;
  si hubo respuesta incierta, consulta ese UUID antes de intentar crear de nuevo.
- La sesión guarda sólo UUID/rutas de limpieza pendientes: no fotos, teléfonos,
  datos del formulario, coordenadas, tokens ni URLs firmadas.
- Borradores reales quedan en Supabase y se retoman desde Mis publicaciones,
  incluso si el almacenamiento de sesión del navegador está bloqueado.
- Selecciones nuevas se previsualizan mediante blob URLs locales, revocadas al
  quitarlas, guardarlas o desmontar el editor.
- No se eliminan versiones nuevas automáticamente si falta confirmar el resultado
  del registro. Se conservan para reconciliar al recargar; limpieza vuelve a comprobar
  referencias en backend. Las limpiezas pendientes permiten reintento explícito.
- Sin borrar la última foto ni el contacto de un anuncio PUBLISHED: **Pausar
  publicación** permite hacerlo, conservando los campos locales del editor.
- URLs de lectura se firman por lote, se renuevan antes de sus 10 minutos y al
  regresar a la vista si vencieron. Nunca se guardan como enlaces permanentes.
- El detalle público reconsulta disponibilidad; ante vencimiento o ausencia deja
  de mostrar el contacto. No agrega suscripciones Realtime.

La compresión utiliza las funciones existentes y genera JPEG/WebP de hasta 2 MiB.
Los archivos originales admitidos en el selector son JPEG/PNG/WebP; el resultado
comprimido usa el formato permitido por el bucket.

## Administrar

En `/mis-publicaciones` se muestran sólo anuncios propios, con foto principal,
precio, estado, localidad y fecha. El filtro y las páginas consultan PostgreSQL.

| Estado | Acciones |
| --- | --- |
| DRAFT | Ver privado, editar, retirar; publicar desde el editor tras revisar. |
| PUBLISHED | Ver público si está disponible, editar, pausar, vender, retirar. |
| PAUSED | Ver privado, editar, reactivar si tiene requisitos, vender, retirar. |
| SOLD / WITHDRAWN | Ver privado; no editar ni reactivar. |

Bloqueo administrativo o suspensión de cuenta deshabilitan las modificaciones.
Los motivos de bloqueo sólo aparecen al propietario. Un vencimiento se informa
como metadata, sin crear un estado nuevo. El editor permite quitar explícitamente
un vencimiento alcanzado antes de volver a publicar.

Los cambios de estado requieren confirmación; vendido/retirado advierten que son
terminales. No hay estado RESERVADO, carrito, checkout ni reservas particulares.

## Compatibilidad

No se modifican SQL, RPC comerciales, stock, tiendas, Auth, perfiles, ubicaciones
comerciales, Radar, ofertas, Realtime o Admin. Mi cuenta/Header reciben sólo
accesos nuevos. Servicios sigue como Próximamente; Crear mi tienda utiliza
`/comercio/crear`. Los artículos no se agregan aún al catálogo/buscador general.

No se encontraron nombres visibles “CER CAYA” en la búsqueda de código realizada;
el módulo usa CercaYa y reutiliza el componente Brand.

## Archivos de esta etapa

Rutas creadas:

- `src/app/publicar/page.tsx`
- `src/app/publicar/articulo/page.tsx`
- `src/app/mis-publicaciones/page.tsx`
- `src/app/mis-publicaciones/[id]/page.tsx`
- `src/app/mis-publicaciones/[id]/editar/page.tsx`
- `src/app/articulo/[id]/page.tsx`
- `src/app/articulo/[id]/not-found.tsx`

Componentes/estilos creados en `src/components/personal-listings/`:

- `personal-shell.tsx`
- `publication-auth-gate.tsx`
- `publish-options.tsx`
- `article-editor.tsx`
- `use-article-editor.ts`
- `article-locality.tsx`
- `article-photos.tsx`
- `article-presentation.tsx`
- `use-signed-photos.ts`
- `my-listings.tsx`
- `owned-article.tsx`
- `public-article.tsx`
- `listing-actions.tsx`
- `listing-action-confirmation.tsx`
- `personal-listings.module.css`
- `publish-access.module.css`

También creado: `src/lib/personal-listings/form.ts` y este documento.

Archivos previos modificados:

- `src/components/home/header.tsx` — accesos desktop/mobile.
- `src/components/auth/account.tsx` — Publicar y Mis publicaciones.
- `PERSONAL_LISTINGS_SETUP.md` — registrar confirmación del usuario y esta etapa.

Las modificaciones/untracked del backend anterior permanecen en el working tree;
no se volvieron a implementar ni ejecutar sus SQL.

## Pruebas manuales que debe hacer el usuario

No se ejecutaron tests, lint, TypeScript, build, navegador, servidores ni despliegue.

1. Visitante: abrir `/publicar`, elegir vender, iniciar sesión o registrarse;
   comprobar regreso al formulario sin crear comercio.
2. Cuenta QA sin comercio: completar datos `[QA]`, guardar sin fotos/contacto y
   recargar. Comprobar borrador en Mis publicaciones.
3. Agregar cinco fotos, moverlas, elegir principal y eliminar una. Revisar fotos
   al volver al editor y comprobar rechazo de una sexta selección.
4. WhatsApp `3547…` de diez dígitos, +54 y +549; comprobar vista previa y URL de
   contacto. Sin consentimiento debe permitir borrador y negar publicación.
5. Publicar y probar doble clic: confirmar que existe un único anuncio.
6. Copiar `/articulo/[id]`, abrir sin sesión y comprobar sólo localidad/provincia,
   contacto autorizado y fotos; no propietario interno ni datos administrativos.
7. Editar en dos pestañas: guardar en una y luego en otra. Debe pedir recargar,
   sin sobrescribir cambios silenciosamente.
8. Pausar/reactivar, vender y retirar con anuncios QA distintos. SOLD/WITHDRAWN
   no se reactivan. Los enlaces públicos de inactivos dejan de estar disponibles.
9. Anuncio bloqueado/cuenta suspendida ya preparados para QA: consultar, sin
   permitir cambios; evitar modificar recursos comerciales reales.
10. Interrumpir la conexión durante guardado/subida, recuperar el borrador y
    reintentar limpieza cuando corresponda. No crear anuncios duplicados.
11. Mantener una vista abierta más de diez minutos y volver desde segundo plano:
    verificar renovación de fotos. Revisar vencimiento si existe un anuncio QA
    con expires_at; no reutilizar SQL de instalación para preparar ese escenario.
12. Revisar móvil y escritorio: formularios, galería, botones, foco de teclado,
    tarjetas, filtro por estado y paginación cuando haya más de 24 anuncios QA.

No hay SQL adicional pendiente para esta etapa. La integración al buscador general
y el frontend de servicios quedan para un pedido posterior.

## Cierre de la continuación del Prompt 3

Se conservó la implementación existente y se revisaron sus archivos mediante
lectura de código y diff, sin ejecutar validaciones automáticas ni SQL.

Correcciones puntuales de esta continuación:

- Recargar tras una respuesta incierta utiliza primero el UUID que sigue en
  memoria. No depende de que sessionStorage funcione para reconciliar ese intento.
- La confirmación final comprueba la revisión esperada, además del estado público;
  un cambio concurrente exige revisar el registro y no se presenta como éxito propio.
- Fotos: una firma fallida invalida el vencimiento local y la vuelta de conexión
  solicita nuevas URLs. Se mantienen renovación previa, foco y regreso desde
  segundo plano, sin persistir URLs firmadas.

La revisión por lectura no acredita funcionamiento en navegador, compilación ni
compatibilidad efectiva con el esquema remoto. Antes del Prompt 4, completar
las pruebas manuales anteriores, especialmente doble clic, desconexión durante
guardado/subida, dos pestañas, cambio de cuenta, estados terminales, bloqueo y
renovación de imágenes. Los módulos comerciales y SQL aplicados no se modificaron.

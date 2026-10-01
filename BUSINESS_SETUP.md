# Comercio real: creación y edición

Actualización de ubicación: [LOCATION_SETUP.md](LOCATION_SETUP.md). El formulario ahora permite obtener coordenadas con permiso explícito y guardarlas al enviar. Volvé a ejecutar el `business-rls.sql` actualizado; sin claves de ubicación, conserva las coordenadas anteriores. El resto de esta guía describe la etapa original del comercio.

Esta etapa guarda únicamente `businesses` y `business_categories` y lee las categorías reales de Supabase. Usa la sesión existente y RLS, sin `service_role`. Productos, pedidos, ofertas, reservas y Radar continúan con los mocks y localStorage existentes.

## SQL adicional que debés ejecutar

En el proyecto donde ya funcionan Auth y profiles:

1. Abrí **SQL Editor**.
2. Pegá el contenido completo de `supabase/business-rls.sql`.
3. Ejecutá **Run** y esperá a que termine sin errores.

No vuelvas a ejecutar `schema.sql`, `seed.sql` ni la migración de Auth. Esta etapa no modifica el esquema inicial ni ejecuta SQL remoto automáticamente.

El archivo agrega:

- Un índice único por `owner_id` cuando no es NULL. Los comercios ficticios del seed, sin dueño, quedan excluidos. La restricción también bloquea duplicados por llamadas directas a la API.
- La función `save_my_business`, ejecutable solo por usuarios autenticados. Es `SECURITY INVOKER`: conserva las políticas RLS y los permisos del usuario que llama.
- Validación del dueño usando `auth.uid()`, validación de campos y categorías, y generación de slug en PostgreSQL. El cliente no envía owner_id ni slug.
- Guardado del comercio y todas sus categorías dentro de la misma transacción. Si falla cualquier parte, no queda un comercio incompleto ni se pierde su selección previa de categorías.
- Serialización de guardados del mismo usuario, para evitar doble creación o reemplazos de categorías intercalados. Los slugs repetidos se resuelven con sufijos; la restricción UNIQUE existente sigue siendo la autoridad incluso con solicitudes simultáneas.

Las políticas actuales ya permiten leer comercios activos, leer/editar el propio y administrar sus categorías; no se amplían permisos sobre comercios ajenos. No se aceptan cambios de `owner_id`, `verified`, `created_at`, `slug` ni `active` desde este formulario/RPC. Cambiar el nombre conserva el slug original.

Si el índice falla porque un usuario ya tiene varios comercios, la transacción se revierte. El archivo no elimina ni reasigna registros. Revisá esos casos administrativamente antes de volver a ejecutarlo; se puede identificar el caso con:

```sql
select owner_id, count(*)
from public.businesses
where owner_id is not null
group by owner_id
having count(*) > 1;
```

Esto es únicamente una consulta manual para ese caso. No fue ejecutada por el asistente. Para permitir varios comercios en el futuro habrá que cambiar este índice y la selección del comercio activo de forma explícita.

## Recorrido

- `/cuenta`: sin comercio muestra **Vender en CercaYa**; con comercio muestra **Mi comercio** y su nombre. No interpreta errores de carga como ausencia de comercio.
- `/comercio/crear`: requiere sesión. Si ya tenés uno, abre `/comercio/mi-negocio`.
- `/comercio/mi-negocio`: muestra el comercio cuyo owner_id es el usuario actual. Si no existe, abre el formulario de creación.
- `/comercio/editar`: edita solamente ese comercio, con las categorías actuales precargadas. No recibe un ID de otra persona por URL.
- `/comercio`: el encabezado muestra el nombre real del negocio del usuario. El selector y las funcionalidades de catálogo/Radar/reservas siguen siendo demo y así se indica.

Las tres rutas del comercio real verifican sesión en el servidor y tienen protección de cliente ante un cierre de sesión. El guardado vuelve a comprobar la identidad y propiedad en PostgreSQL. Los comercios activos de otras personas pueden continuar siendo visibles públicamente según RLS; eso no concede permiso de edición.

## Campos y validaciones

- Nombre obligatorio, hasta 160 caracteres; descripción opcional, hasta 3000.
- WhatsApp obligatorio: de 8 a 15 dígitos, admite un `+` inicial, espacios, guiones y paréntesis. Se guarda normalizado en dígitos. No se envían mensajes.
- Ciudad/localidad y dirección obligatorias, como texto libre. No se piden coordenadas; los comercios nuevos quedan con latitude/longitude NULL.
- Al menos una categoría, leída desde la tabla `categories`. No se usa el catálogo mock de categorías.
- Debe haber al menos una modalidad: retiro o envío.
- Con envío, radio de 5, 10, 15, 20 o 30 km y costo desde 0. Sin envío, radio y costo se guardan en 0.
- Compra mínima opcional; vacío equivale a 0. Los importes admiten hasta dos decimales.
- Los comercios nuevos usan los valores predeterminados `verified = false` y `active = true`.

El guardado deshabilita controles y muestra **Creando comercio…** o **Guardando cambios…**. Los mensajes internos de PostgreSQL no se muestran al usuario. Si falla una lectura después de guardar, se permite reintentar la lectura; no se informa falsamente que la transacción guardada fracasó.

## Prueba manual exacta

1. Ejecutá el SQL adicional anterior. Entrá a `http://127.0.0.1:3000/login` con una cuenta real que tenga profile y todavía no tenga comercio.
2. En `/cuenta`, tocá **Vender en CercaYa**. Debe abrir `/comercio/crear`.
3. Completá, por ejemplo: nombre **Ferretería El Centro**, descripción, WhatsApp **3510000000**, ciudad **Alta Gracia**, dirección **Calle de Prueba 100**. Elegí Ferretería, Electricidad y Herramientas. Habilitá retiro y envío a 15 km, costo 2500 y compra mínima vacía.
4. Tocá **Crear comercio** una vez. Debe mostrar estado de guardado y abrir **Mi comercio** con esos valores. Una segunda entrada a `/comercio/crear` debe volver a tu negocio, sin crear otra fila.
5. En Supabase **Table Editor → businesses**, comprobá la fila: owner_id coincide con el UUID de tu usuario, slug comienza con `ferreteria-el-centro`, active es true, verified es false, latitude y longitude son NULL. Si ese slug ya existía, debe tener un sufijo único.
6. En **business_categories**, filtrá por el UUID del comercio y comprobá las tres relaciones. Los category_id deben corresponder a las categorías reales elegidas.
7. Volvé a `/cuenta`: debe mostrar **Mi comercio** y el nombre. Abrilo y tocá **Ir al panel**: el encabezado debe mostrar el nombre real; los datos operativos inferiores continúan marcados como demo.
8. Tocá **Editar comercio**. Cambiá el nombre, descripción o WhatsApp; agregá o quitá categorías; probá envío gratis poniendo costo 0. Guardá y recargá `/comercio/mi-negocio`.
9. Comprobá que los cambios persisten tanto en la app como en Supabase. El slug, owner_id, verified y created_at deben conservarse; updated_at cambia. Al desactivar envío, costo y radio deben quedar en 0.
10. Cerrá sesión y entrá con otro usuario real. Abrí `/comercio/editar`: debe mostrar su propio comercio o llevarlo a crear uno, nunca cargar el de la primera cuenta. Agregar `?id=UUID-DE-LA-PRIMERA-CUENTA` no selecciona otro comercio.
11. Para comprobar la autorización de escritura real, opcionalmente desde las herramientas de red de TU navegador, con la segunda cuenta, copiá una llamada propia a `save_my_business` y cambiá únicamente `p_business_id` por el UUID de la primera. Debe rechazarse sin modificarla. Conservá la sesión de la segunda cuenta: usar SQL Editor como administrador o el token de la primera no comprueba RLS de otro usuario. No compartas tokens ni la llamada copiada.
12. Con la segunda cuenta, creá un negocio con el mismo nombre de la primera. Debe recibir otro slug y conservar ambos comercios. Intentá crear un segundo negocio del mismo usuario desde otra pestaña: debe abrir el existente o rechazar el duplicado, nunca insertar otro.
13. Sin sesión, abrí `/comercio/crear`: debe enviarte a `/login?redirect=/comercio/crear` (el destino puede verse codificado en la URL) y continuar después del login.

## Archivos creados

- `supabase/business-rls.sql`
- `src/lib/businesses/client.ts`
- `src/lib/businesses/form.ts`
- `src/components/businesses/business-provider.tsx`
- `src/components/businesses/business-form.tsx`
- `src/components/businesses/my-business.tsx`
- `src/app/comercio/mi-negocio/page.tsx`
- `src/app/comercio/editar/page.tsx`
- `BUSINESS_SETUP.md`

## Archivos modificados

- `src/types/database.ts`: tipo de la RPC, reutilizando BusinessRow y CategoryRow.
- `src/app/layout.tsx`: proveedor compartido del comercio actual.
- `src/proxy.ts`: protección de Mi negocio y Editar.
- `src/app/comercio/crear/page.tsx`: formulario real en lugar del aviso de futura etapa.
- `src/components/auth/account.tsx`: acceso según existencia del comercio.
- `src/components/radar/merchant-workspace.tsx`: nombre real en el encabezado del panel.
- `src/components/requests/request-shell.tsx`: acceso Mi comercio en la navegación comercial.
- `README.md` y `AUTH_SETUP.md`: referencia a esta etapa.

No se modificaron stores locales, modelos de producto/pedido/oferta/reserva ni el motor de Radar. No se ejecutaron pruebas, lint, build, SQL remoto, navegador ni validaciones visuales. La ejecución del SQL y las comprobaciones manuales quedan a tu cargo.

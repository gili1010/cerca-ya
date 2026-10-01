# Preparación inicial de Supabase para CercaYa

> Esta guía corresponde a la etapa inicial del esquema. La etapa actual agrega Auth y perfil: seguí [AUTH_SETUP.md](AUTH_SETUP.md) para la migración adicional, cookies de sesión y confirmación de email. Los clientes ya fueron adaptados para Auth; productos, pedidos, ofertas, reservas y Radar siguen locales. Si ya ejecutaste el esquema y seed, no los ejecutes otra vez.

La app **sigue usando localStorage y los datos mock**. Crear las tablas o completar variables de entorno no cambia Home, búsqueda, Pedido Abierto, ofertas, reservas ni Radar. No hay consultas, migración, login, Realtime ni carga de imágenes conectados.

`@supabase/supabase-js` ya estaba declarado en `package.json` e instalado en el proyecto. No se agregó otra dependencia. Los clientes nuevos son opcionales y se crean solamente cuando se llama a sus funciones; ninguna pantalla actual los invoca.

## 1. Crear un proyecto

1. Entrá al [dashboard de Supabase](https://supabase.com/dashboard) con tu cuenta.
2. Elegí **New project**, seleccioná una organización y poné un nombre, por ejemplo `cercaya-desarrollo`.
3. Elegí una contraseña segura para la base de datos y guardala fuera del repositorio. Elegí la región apropiada y esperá a que el proyecto termine de prepararse.
4. Usá un proyecto **nuevo y vacío** para estos archivos. `schema.sql` es el esquema inicial completo, no una migración del antiguo borrador `stores/products`.

Si ya ejecutaste el esquema anterior, no pegues este archivo encima ni borres tablas para forzarlo: se necesitará una migración específica en otra etapa. El script se ejecuta en una transacción y fallará ante nombres ya existentes sin eliminar tablas. No es un script para ejecutar repetidamente.

## 2. Obtener URL y clave pública

En el proyecto, abrí **Connect** para encontrar la **Project URL** y la clave pública. Las claves también están en **Settings → API Keys**. Los nombres exactos del dashboard pueden cambiar; Supabase documenta ambas entradas en su [guía de API keys](https://supabase.com/docs/guides/getting-started/api-keys).

- `NEXT_PUBLIC_SUPABASE_URL`: la URL HTTPS del proyecto, normalmente `https://<referencia>.supabase.co`. No es la cadena de conexión PostgreSQL ni una URL terminada en `/rest/v1`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: la clave **anon** de la sección de claves legacy, si tu proyecto la ofrece. Se mantiene este nombre solicitado para compatibilidad.
- Supabase recomienda actualmente la clave pública **publishable**, que empieza por `sb_publishable_`. También está admitida mediante `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Si tu proyecto usa esta opción, dejá ANON_KEY vacía y completá PUBLISHABLE_KEY. Si ambas están definidas, tiene prioridad PUBLISHABLE_KEY. [Referencia oficial](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).

**Nunca uses `service_role`, `sb_secret_...`, la contraseña de la base o un token personal en variables `NEXT_PUBLIC_`.** Estas variables se incluyen en el código del navegador. Una clave pública no reemplaza la autenticación de usuarios; el acceso se controla mediante permisos y RLS.

## 3. Crear `.env.local`

Copiá `.env.local.example` a un archivo llamado `.env.local`, en la raíz de CercaYa, junto a `package.json`.

Para una clave anon:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-REFERENCIA.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=TU-CLAVE-ANON-PUBLICA
```

O, para una clave publishable:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU-REFERENCIA.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU-CLAVE-PUBLISHABLE-PUBLICA
```

Reemplazá los textos de ejemplo con los valores de tu proyecto, sin compartirlos en capturas innecesarias. `.gitignore` ignora `.env.local` y los demás archivos de entorno reales; solo permite los archivos de ejemplo. No se creó ningún archivo con credenciales reales en esta etapa.

Cuando quieras que Next.js lea los cambios, reiniciá tu servidor de desarrollo. Podés dejar las variables vacías: la demo local sigue funcionando. Completarlas **no** dispara ninguna conexión ni cambia el origen de los datos.

## 4. Ejecutar el esquema, manualmente

1. En el dashboard de tu proyecto nuevo, entrá a **SQL Editor**.
2. Abrí una consulta nueva.
3. Copiá el contenido completo de `supabase/schema.sql` y pegalo allí.
4. Ejecutalo con **Run**, como el rol administrativo predeterminado del editor.
5. Esperá a que termine sin errores antes de continuar. Si falla, conservá el mensaje; no ejecutes el seed ni elimines tablas para intentar corregirlo.

El archivo usa UUID, `timestamptz`, claves foráneas, restricciones, índices, enums y RLS. No crea usuarios de Auth. `profiles.id` ya referencia `auth.users.id`, pero la creación de perfiles al registrarse queda para la etapa de autenticación.

## 5. Ejecutar los datos de desarrollo

1. Abrí otra consulta en **SQL Editor**.
2. Pegá el contenido completo de `supabase/seed.sql`.
3. Ejecutá con **Run**.

En un proyecto nuevo agrega **8 categorías, 3 comercios, 6 relaciones comercio/categoría y 5 productos**. Incluye Ferretería Norte, Electro Centro y Tecnología Sur; taladro, térmica, cargador, mecha y amoladora.

Las direcciones son ficticias. No inserta teléfonos personales, coordenadas, usuarios, perfiles, pedidos, ofertas ni reservas. `owner_id` queda `NULL`: los comercios seed se pueden leer, pero ningún usuario puede apropiarse de ellos mediante la API. Su asignación administrativa a usuarios reales será posterior a Auth.

Los IDs del seed son fijos. Volver a ejecutarlo conserva los registros que ya tengan esos IDs; no restablece el stock ni sobrescribe modificaciones. No lo uses como mecanismo de importación de datos reales.

## 6. Comprobar las tablas desde el dashboard

En **Table Editor**, elegí el esquema `public`. Deberías ver estas 11 tablas:

| Tabla | Propósito |
| --- | --- |
| `profiles` | Datos privados del usuario, relacionados con Auth |
| `businesses` | Comercios, dueño y configuración de retiro/envío |
| `categories` | Categorías jerárquicas |
| `business_categories` | Categorías que vende cada comercio |
| `products` | Catálogo, precios y stock |
| `product_images` | Referencias URL y orden de imágenes; no crea buckets |
| `requests` | Pedido Abierto, urgencia, radio y vencimiento |
| `offers` | Respuestas del comercio y producto vinculado opcional |
| `reservations` | Cantidad, precios, modalidad, estados y fechas |
| `favorites` | Productos guardados por usuario |
| `search_events` | Búsquedas para futura analítica, con acceso privado |

Abrí `categories`, `businesses` y `products` para ver los registros del seed. Las tablas que dependen de usuarios reales deben estar vacías.

Si preferís comprobar los conteos en SQL Editor, podés ejecutar manualmente:

```sql
select 'categories' as tabla, count(*) as filas from public.categories
union all select 'businesses', count(*) from public.businesses
union all select 'business_categories', count(*) from public.business_categories
union all select 'products', count(*) from public.products;
```

En **Authentication → Policies** o en la sección RLS/policies de cada tabla, revisá que RLS esté activado y las políticas figuren creadas. También podés consultar:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'businesses', 'categories', 'business_categories',
    'products', 'product_images', 'requests', 'offers', 'reservations', 'favorites', 'search_events')
order by tablename;
```

Las 11 filas deben mostrar `rowsecurity = true`. El editor SQL administrativo puede omitir RLS: ver datos allí **no demuestra** que un cliente anónimo o un usuario pueda verlos. La comprobación por roles de usuario corresponderá a la etapa de autenticación. [Documentación de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Políticas y límites preparados

| Datos | Lectura | Escritura preparada |
| --- | --- | --- |
| Perfiles | Solo el usuario propietario | Crear/editar su nombre, teléfono y avatar |
| Comercios | Activos para público; propios incluso inactivos | Dueño; no permite cambiar dueño o autoasignarse verificación |
| Categorías | Pública | Administración |
| Categorías de comercio | Según visibilidad del comercio | Dueño del comercio |
| Productos e imágenes | Activos de comercios activos; dueño ve los propios | Solo dueño; el producto no puede trasladarse a otro comercio |
| Pedidos | Solo comprador; incluye coordenadas privadas | Crear OPEN y cerrar/cancelar un pedido propio abierto y vigente |
| Ofertas | Comercio emisor y comprador del pedido | Comercio propio activo; pedido abierto y vigente; editar la misma oferta o retirarla |
| Reservas | Comprador y dueño del comercio receptor | Crear PENDING con cantidad disponible, precio de catálogo y tarifa/modalidad válidas; cambios de estado preparados pero todavía bloqueados para la API |
| Favoritos | Solo usuario | Agregar/quitar propios, sin duplicados |
| Búsquedas | Solo usuario propio | Registrar propias; eventos anónimos reservados a un futuro backend |

**Reservas:** `total` es una columna calculada, no un importe que pueda enviar libremente el cliente. Hay políticas de cancelación del comprador y gestión del comercio, pero **no se concede UPDATE directo**. Antes de habilitar cambios remotos hay que implementar operaciones transaccionales que validen transiciones, vencimiento, descuento/restauración de stock y concurrencia. No alcanza con agregar un GRANT. Esta tarea no migra ni modifica el módulo local de reservas.

**Privacidad del Radar:** los comercios no tienen SELECT sobre la tabla cruda `requests`, que contiene coordenadas. El futuro Radar remoto necesita una API/proyección con campos limitados y distancia aproximada. El predicado privado de ofertas solo comprueba comercio propietario activo y pedido abierto/vigente; la comprobación geográfica real queda pendiente. Tampoco se permite al comercio leer búsquedas individuales ni perfiles de compradores.

**Datos internos:** mantené el esquema `private` fuera de los esquemas expuestos de la Data API. Contiene predicados de autorización y el trigger común `updated_at`. Las funciones auxiliares tienen `search_path` fijo y permisos explícitos. No hay vistas que expongan coordenadas.

**Estados:** pedidos OPEN/CLOSED/CANCELLED/EXPIRED; reservas PENDING/CONFIRMED/READY/COMPLETED/CANCELLED/EXPIRED; ofertas ACTIVE/WITHDRAWN/ACCEPTED/REJECTED/EXPIRED. La aceptación de ofertas y las transiciones remotas de reservas necesitan lógica posterior. `expires_at` almacena el vencimiento; no se instaló un proceso que cambie estados automáticamente.

**Duplicados:** `offers(request_id, business_id)` es único. Un comercio podrá editar su misma fila; no tiene que crear otra. Si en el futuro se necesitan múltiples versiones, se diseñará un historial. Favoritos y categorías de comercio usan claves compuestas. La relación compuesta producto/comercio impide vincular una oferta o reserva a un producto ajeno.

**Índices:** son básicos, incluyendo nombre de producto, comercios, categorías, propietarios, estados y fecha de búsquedas. El índice único de ofertas ya cubre búsquedas por `request_id`. No se agrega GIS ni búsqueda semántica o extensiones de búsqueda.

## Clientes y tipos

- `src/lib/supabase/config.ts`: lee solo configuración pública; acepta las variables solicitadas y la alternativa publishable.
- `src/lib/supabase/client.ts`: cliente de navegador opcional, lazy y tipado. Sin variables devuelve `null`.
- `src/lib/supabase/server.ts`: cliente público de servidor por invocación, sin sesión compartida, cookies ni privilegios administrativos. **No es todavía un cliente SSR autenticado**; al implementar Auth se adaptará con `@supabase/ssr`.
- `src/lib/supabase.ts`: conserva el nombre previo `getSupabaseClient` como alias del cliente de navegador.
- `src/types/database.ts`: contrato de tablas, filas, inserciones, actualizaciones, relaciones y enums; elaborado a partir del SQL, sin conectarse a Supabase. Los tipos describen datos, no conceden permisos.

Los modelos existentes de UI continúan en sus archivos originales. Se reutiliza el tipo de estados de reservas y se amplía el de pedidos solo dentro del contrato SQL. UUID, columnas `snake_case`, relaciones y enums de base requieren adaptadores futuros; no se confunden con IDs locales `PED-1001`/`RES-1001` ni con las etiquetas de urgencia de la interfaz. Antes de migrar, conviene generar los tipos desde el esquema realmente desplegado.

## Archivos de esta etapa

**Creados:** `.env.local.example`, `src/lib/supabase/config.ts`, `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/types/database.ts`, `supabase/seed.sql`, `SUPABASE_SETUP.md`.

**Modificados:** `.gitignore`, `.env.example`, `src/lib/supabase.ts`, `supabase/schema.sql`, `README.md`.

No se modificaron componentes, stores locales ni dependencias. No se ejecutaron pruebas, build, lint, SQL, migraciones remotas ni navegador. No se conectó ningún proyecto real. La ejecución y comprobación manual de estos archivos queda a tu cargo siguiendo los pasos anteriores.

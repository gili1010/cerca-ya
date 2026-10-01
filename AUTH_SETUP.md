# Auth + perfil de usuario

> Etapa posterior disponible: [BUSINESS_SETUP.md](BUSINESS_SETUP.md) habilita creación y edición de comercios reales. El aviso de próxima etapa de `/comercio/crear` se reemplazó por ese formulario. Las instrucciones de Auth y confirmación de esta guía siguen vigentes.

Esta etapa agrega Supabase Auth con email/contraseña y lectura/creación del perfil propio. Home, búsqueda y productos siguen públicos. Productos, Pedido Abierto, ofertas, reservas y Radar continúan usando los mismos datos locales.

## Configuración que tenés que completar

### 1. Crear perfiles al registrarse

En el proyecto donde ya ejecutaste el esquema, abrí **SQL Editor** y ejecutá manualmente:

`supabase/migrations/20260928_auth_profiles.sql`

No vuelvas a ejecutar `schema.sql` ni `seed.sql`.

La migración agrega un trigger sobre `auth.users` que crea `public.profiles` con el mismo UUID, nombre y teléfono recibidos durante el registro. Funciona incluso con confirmación de email activada, cuando el registro todavía no entrega sesión al navegador. Completa perfiles faltantes de usuarios existentes sin sobrescribir los que ya tienen perfil. No guarda contraseñas ni crea usuarios artificiales.

La función tiene permisos restringidos y `search_path` fijo. La app también comprueba el perfil tras iniciar sesión y puede crear uno faltante usando la sesión del propio usuario y las políticas RLS existentes. No necesita `service_role`.

Referencia del patrón: [Supabase, gestión de datos de usuario](https://supabase.com/docs/guides/auth/managing-user-data).

### 2. Habilitar Email

En **Authentication**, buscá **Sign In / Providers** o **Providers**, y abrí **Email**:

- Habilitá el proveedor Email y permití registros nuevos.
- Revisá si **Confirm email** está activado. La app admite ambas opciones; no hace falta desactivarlo.
- La app exige al menos 6 caracteres. Si tu proyecto exige una contraseña más fuerte, usá esa exigencia superior al probar.
- No se agregó login social ni recuperación de contraseña.

### 3. Configurar las URLs

En **Authentication → URL Configuration**:

- Para desarrollo, usá como **Site URL** `http://127.0.0.1:3000` si es el origen habitual de tu app.
- En **Redirect URLs**, agregá `http://127.0.0.1:3000/**` para permitir los callbacks locales con el destino de retorno.
- Si también vas a usar `localhost`, agregá `http://localhost:3000/**`, pero probá cada flujo en un único origen: cookies y datos locales no se comparten entre localhost y 127.0.0.1.
- Al desplegar, reemplazá los valores locales por el dominio HTTPS real y restringí la lista de retorno a las rutas necesarias. El comodín amplio anterior es solo para desarrollo.

La app envía como `emailRedirectTo` una URL como:

`http://127.0.0.1:3000/auth/confirm?redirect=%2Fcuenta`

Si el registro comenzó desde una reserva, conserva ese destino en lugar de `/cuenta`. Los destinos externos, URLs de protocolo relativo y retornos hacia los endpoints de Auth se rechazan.

### 4. Revisar la plantilla de confirmación

En **Authentication → Email Templates → Confirm signup**, podés usar este enlace:

```html
<h2>Confirmá tu cuenta de CercaYa</h2>
<p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Confirmar mi cuenta</a></p>
```

La app siempre envía `RedirectTo` con `?redirect=...`, por eso el resto de parámetros se agrega con `&amp;`. Este enlace usa `/auth/confirm`, verifica el token con Supabase y permite confirmar desde otro navegador o dispositivo; no depende del verificador PKCE guardado en el navegador original.

Si mantenés la plantilla predeterminada con `{{ .ConfirmationURL }}`, también se admite el callback `?code=...` del flujo PKCE. En ese caso abrí el correo en el mismo navegador y origen donde empezaste el registro. Para facilitar pruebas entre dispositivos, preferí la plantilla con token de arriba.

Si el enlace venció o ya fue utilizado, se muestra un mensaje breve en login. Si la cuenta ya estaba confirmada, podés iniciar sesión con tu contraseña. No se agregó reenvío de confirmación ni recuperación de contraseña en esta etapa.

Referencia: [Supabase, Auth con Next.js](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs).

### 5. Revisar envío de emails y entorno local

- Revisá los límites de correo del proyecto y el proveedor SMTP si Supabase limita los destinatarios. Un registro pendiente de confirmación necesita que el correo llegue; revisá spam.
- Conservá la URL y la clave pública configuradas en `.env.local`. Se admiten ANON_KEY o PUBLISHABLE_KEY. No agregues claves secretas ni `service_role`.
- Se instalaron `@supabase/ssr` y `server-only`. Reiniciá el servidor de desarrollo para que Next.js detecte `src/proxy.ts` y los cambios de dependencias. No hace falta cambiar variables ni ejecutar una migración de localStorage.

## Prueba manual, paso a paso

1. Ejecutá el SQL adicional y revisá la configuración anterior. Abrí la app en `http://127.0.0.1:3000`.
2. Desde Home tocá **Iniciar sesión**, después **No tengo cuenta. Registrarme**. También podés abrir `/registro`.
3. Completá nombre, un email al que tengas acceso, teléfono opcional y dos contraseñas iguales de al menos seis caracteres. Tocá **Crear cuenta**. Los campos inválidos deben mostrar un mensaje entendible.
4. Si Confirm email está activado, debe aparecer **Cuenta creada. Revisá tu email para confirmar la cuenta.** Abrí el enlace del correo. Si está desactivado, aparece **Cuenta creada** con **Continuar**, y la sesión ya queda iniciada.
5. En Supabase, revisá **Authentication → Users** y la tabla **profiles**. El usuario y su perfil deben tener el mismo UUID; el perfil guarda nombre y teléfono, nunca contraseña. No uses el rol administrador del SQL Editor como comprobación de RLS.
6. Entrá a `/login` con email y contraseña si todavía no tenés una sesión. Sin un destino especial, debe llevarte a `/cuenta`.
7. Recargá `/cuenta`. Debe conservar la sesión y mostrar nombre, email y teléfono. El header debe mostrar tu nombre o **Mi cuenta**. Si el perfil no pudo cargarse, el mensaje ofrece **Reintentar perfil**.
8. Probá los accesos a **Mis pedidos**, **Mis reservas**, **Guardados** y **Vender en CercaYa**. Vender abre un aviso de próxima etapa; no registra comercios. Pedidos y reservas siguen siendo los del navegador demo.
9. Desde Mi cuenta tocá **Cerrar sesión**. Debe volver a Home y mostrar **Iniciar sesión**. Recargá y comprobá que `/cuenta` vuelve a login.
10. Sin sesión, abrí `/producto/taladro` y tocá **Reservar**. El producto sigue siendo público, pero el formulario de reserva debe redirigir a `/login?redirect=...`, conservando `/producto/taladro/reservar` y la modalidad elegida si era envío.
11. Iniciá sesión. Debe regresar al formulario de reserva. Podés continuar el flujo local existente, que todavía registra **Cliente Demo**. No crea reservas en Supabase.
12. Cerrá sesión y probá **Publicar pedido**: debe pedir login y conservar el texto de búsqueda precargado. Probá el corazón de un producto: debe pedir login y volver al producto; tocá de nuevo Guardar para guardarlo durante esta visita.
13. Opcional: mantené una segunda pestaña abierta en la cuenta. Al cerrar sesión en la primera, la sesión compartida por Supabase debe actualizarse y la vista protegida debe volver a login.

## Arquitectura y compatibilidad

- Un único `AuthProvider` comparte usuario, sesión, perfil y estados de carga con los componentes. Los eventos de Auth los administra el SDK; la consulta de perfil se hace fuera del callback para no bloquear su mecanismo de sesión.
- `@supabase/ssr` administra cookies, persistencia y renovación. No se guardan contraseñas en localStorage ni se escriben tokens manualmente en otro almacén.
- `src/proxy.ts` sigue la convención de Next.js 16. Verifica claims, renueva cookies, preserva cookies en redirecciones y evita cachear respuestas de sesión.
- Las páginas protegidas verifican además el usuario en el servidor con `getUser`; un guard del cliente responde al cierre de sesión con la página abierta. La sesión del cliente sirve para la UI, no sustituye RLS.
- El callback admite token de confirmación y código PKCE, limpia los parámetros al redirigir y no muestra errores técnicos ni tokens al usuario.
- Los perfiles usan los tipos `ProfileRow`/`Database` existentes. No se cambiaron modelos de productos, pedidos, ofertas ni reservas.
- Temporalmente los datos comerciales locales conservan el identificador `comprador-demo`. Asociarlos a UUID reales requeriría cambiar filtros y operaciones de todo ese módulo; se deja explícitamente para otra etapa. El almacenamiento local compartido es una demo, no aislamiento de datos por cuenta.
- Guardados sigue siendo temporal en memoria, separado por usuario durante la visita. No se persiste en Supabase ni se promete conservarlo al recargar. Los datos existentes de localStorage no se borran al cerrar sesión.
- La creación real del comercio, recuperación de contraseña, edición del perfil, favoritos remotos y migración de los flujos quedan fuera de esta etapa.

## Archivos creados

- `src/proxy.ts`
- `src/lib/auth/redirect.ts`
- `src/lib/auth/server.ts`
- `src/lib/auth/profile.ts`
- `src/lib/auth/errors.ts`
- `src/components/auth/auth-provider.tsx`
- `src/components/auth/require-auth.tsx`
- `src/components/auth/auth-form.tsx`
- `src/components/auth/account.tsx`
- `src/components/auth/saved-products.tsx`
- `src/app/login/page.tsx`
- `src/app/registro/page.tsx`
- `src/app/cuenta/page.tsx`
- `src/app/guardados/page.tsx`
- `src/app/comercio/crear/page.tsx`
- `src/app/auth/confirm/route.ts`
- `supabase/migrations/20260928_auth_profiles.sql`
- `AUTH_SETUP.md`

## Archivos modificados

- `package.json` y `package-lock.json`: paquetes SSR y marcador server-only.
- `src/lib/supabase/client.ts` y `src/lib/supabase/server.ts`: clientes con sesión mediante cookies.
- `src/app/layout.tsx`: proveedor global de Auth.
- `src/components/demo-provider.tsx`: navegación a cuenta y control de guardados.
- `src/components/home/header.tsx`: acceso dinámico a cuenta.
- `src/components/home/home-dialogs.tsx`: textos y accesos compatibles con Auth.
- `src/app/producto/[id]/reservar/page.tsx`: guard de reserva con retorno.
- `src/app/pedido/nuevo/page.tsx`: guard de publicación con retorno.
- `src/components/requests/offer-detail.tsx`: login antes de reservar una oferta demo.
- `src/components/reservations/reservation-form.tsx`: aclara compatibilidad con Cliente Demo.
- `src/app/workflows.css`: ajuste mínimo para emails largos.
- `README.md` y `SUPABASE_SETUP.md`: referencia a esta etapa.

No se ejecutaron pruebas automáticas, lint, build, suites, navegador ni registros de prueba. La migración SQL está preparada pero no fue ejecutada remotamente. La configuración y las comprobaciones manuales anteriores quedan a tu cargo.

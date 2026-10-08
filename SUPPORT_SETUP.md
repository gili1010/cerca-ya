# Soporte básico de CercaYa

Implementación pendiente de configuración y prueba manual. No se ejecutaron tests,
build, lint, navegador, E2E ni SQL remoto.

## Recuperación de contraseña

- Login enlaza a `/recuperar-clave`.
- El cliente existente ejecuta `resetPasswordForEmail` con
  `new URL('/auth/confirm', window.location.origin)` y `next=/restablecer-clave`. Funciona con el origen
  actual de localhost, cercaya.com.ar o una URL de preview, sin dominio fijo.
- Siempre se muestra la misma respuesta después de pedir recuperación, incluso
  cuando Supabase rechaza la solicitud, para no revelar si existe la cuenta.
- La plantilla Reset Password enlaza directamente a `/auth/confirm` con
  `token_hash` y `type=recovery`. El callback usa `verifyOtp` para validar el token
  y establecer la sesión SSR, sin necesitar el code_verifier del navegador inicial.
  `next` se valida con el helper de rutas internas seguras. Se conserva el manejo
  anterior de códigos PKCE para compatibilidad con enlaces emitidos antes del cambio.
- El intercambio establece la sesión mediante las cookies de Supabase. No hay
  tokens propios. Un enlace consumido, vencido o inválido muestra el estado inválido,
  incluso si existía otra sesión en el navegador.
- Sin un enlace en la URL, la pantalla sólo permite continuar con una sesión
  validada por `getUser()`. Una sesión autenticada válida también puede cambiar
  su propia contraseña; nunca la de otra cuenta.
- La nueva contraseña debe tener entre 6 y 256 caracteres y coincidir con la
  repetición. Se guarda con `auth.updateUser({ password })`, no con SQL.
- Tras el cambio se intenta cerrar la sesión local y se ofrece iniciar sesión.
- Los nuevos enlaces TokenHash pueden abrirse en otro navegador o dispositivo.
  Los enlaces PKCE emitidos antes de cambiar la plantilla siguen teniendo su
  limitación anterior: solicitar uno nuevo después de configurar la plantilla.
- Google OAuth, registro y configuración de perfiles mantienen su flujo actual.

## Contacto y seguridad

`/contacto` es público. El formulario precarga nombre, email y teléfono disponibles
de la sesión/perfil. Si el usuario los edita, una actualización del perfil no pisa
esos campos. Enviar no modifica el perfil.

Campos y límites:

| Campo | Validación |
| --- | --- |
| Nombre | Obligatorio, hasta 120 caracteres |
| Método | PHONE (WhatsApp / teléfono) o EMAIL |
| Teléfono | Hasta 40 caracteres; entre 8 y 15 dígitos, con separadores usuales |
| Email | Formato válido, hasta 254 caracteres |
| Motivo | Una de las siete opciones de la pantalla |
| Pedido | Texto opcional de hasta 80 caracteres, sin exigir UUID |
| Mensaje | Obligatorio, hasta 2000 caracteres |

Se exige el dato correspondiente al método elegido. Los datos opcionales, si se
completan, también deben ser válidos. No se solicitan DNI, dirección ni nacimiento.

El navegador envía a `POST /api/contacto`. El servidor comprueba origen, tipo y
tamaño del cuerpo (16 KiB máximo), honeypot y campos. Luego obtiene la identidad
con `getUser()`; ignora cualquier `user_id` enviado por el formulario.

El servidor invoca `create_contact_request` con una clave exclusivamente privada.
La tabla `private.contact_requests` tiene RLS habilitada y ningún permiso para
anon/authenticated. La RPC sólo tiene EXECUTE para service_role. No hay lectura,
INSERT, edición ni resolución desde el navegador. Cada consulta nace como OPEN.

Las constraints de PostgreSQL validan también longitud, formato, motivo y método.
El límite es de cinco consultas por hora para los mismos datos de contacto o
cuenta. Usa la tabla existente de consultas y bloqueos transaccionales, por lo que
no depende de memoria de una instancia de Vercel. Es protección básica, no CAPTCHA:
un bot que cambia todas sus identidades puede evadir el límite.

Un honeypot completado devuelve éxito genérico sin guardar ni enviar email.
Un error al guardar devuelve un error amigable; no se envía email en ese caso.

Después del guardado se intenta enviar texto plano con Resend mediante su API
HTTP. No fue necesario instalar una dependencia. Incluye datos de contacto,
motivo, pedido, mensaje, fecha, referencia interna y user ID cuando corresponde.
No incluye secretos. El intento tiene un timeout de ocho segundos y una clave de
idempotencia por consulta. No hay cola ni reintentos automáticos.

Si faltan variables de email, Resend rechaza el envío o hay timeout, el registro
queda guardado y el usuario recibe «Recibimos tu consulta». Sólo se registra un
warning genérico en servidor, sin destinatario, claves, cuerpos ni errores del proveedor.

## Configuración manual

1. Ejecutar únicamente `supabase/contact-support.sql` como delta de esta etapa.
2. Configurar en `.env.local` y en Vercel, sin prefijo NEXT_PUBLIC_:
   - `SUPABASE_SECRET_KEY=`: secret key (`sb_secret_...`) del proyecto Supabase. Necesaria
     para guardar; no reutilizarla como clave pública.
   - `RESEND_API_KEY`: clave de envío de Resend.
   - `CONTACT_RECIPIENT_EMAIL`: correo privado que recibirá las consultas.
   - `CONTACT_FROM_EMAIL`: remitente verificado, por ejemplo
     `CercaYa <no-reply@cercaya.com.ar>`.
3. Mantener las variables públicas de Supabase existentes. No hay nueva variable de dominio.
4. Reiniciar el servidor local al configurar variables; en Vercel volver a desplegar.
5. En Resend agregar/verificar el dominio remitente con los registros DNS indicados
   por su dashboard y generar una API key de envío. Verificar el remitente antes
   de esperar entrega en producción. No hace falta una casilla soporte@ para el formulario.
6. Los emails de recuperación siguen perteneciendo a Supabase Auth, no al endpoint
   de contacto. Mantener Site URL `https://cercaya.com.ar` y los Redirect URLs
   actuales para localhost y producción.
7. En Authentication → Email Templates → Reset Password, reemplazar el cuerpo
   por esta plantilla. No usar ConfirmationURL para este flujo:

   ```html
   <h2>Recuperá tu contraseña de CercaYa</h2>
   <p>Tocá el enlace para crear una contraseña nueva.</p>
   <p><a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Crear nueva contraseña</a></p>
   <p>Si no solicitaste este cambio, podés ignorar este email.</p>
   ```

   La app envía RedirectTo con `/auth/confirm?next=/restablecer-clave`; por eso
   los parámetros se agregan con `&amp;`, no con otro `?`. El origen enviado
   conserva localhost o producción. Guardar la plantilla antes de pedir otro email.
8. Para activar Custom SMTP en Supabase (Authentication → Email → SMTP Settings):
   remitente `no-reply@cercaya.com.ar`, nombre CercaYa, host `smtp.resend.com`,
   puerto 465, usuario `resend` y contraseña la API key de Resend. Configurar
   directamente en Supabase, nunca exponer estas credenciales al navegador.
9. Revisar límites de emails de Supabase y del proveedor. Sin Custom SMTP, el
   servicio predeterminado de Supabase tiene restricciones de destinatarios y
   límites que pueden impedir pruebas con usuarios reales.

Referencias oficiales:

- [Supabase: recuperación](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend: verificar dominio](https://resend.com/docs/dashboard/domains/introduction)
- [Resend: configuración SMTP con Supabase](https://resend.com/docs/send-with-supabase-smtp)

## Textos actualizados

Footer: Contacto ahora enlaza a `/contacto` sin cambiar su diseño.
Privacidad, Términos y Reglas para Comercios reemplazan las instrucciones para
escribir a la casilla inexistente por «Formulario de contacto de CercaYa».
El resto del contenido legal no se modificó.

## Prueba manual en localhost

1. Aplicar el delta y configurar las variables de Supabase y service_role.
   Para probar guardado sin email, dejar RESEND_API_KEY vacía y reiniciar.
2. Abrir `http://localhost:3000/login` y tocar «¿Olvidaste tu contraseña?».
3. Solicitar recuperación para una cuenta de prueba. Repetir con un email
   inexistente: la respuesta visible debe ser idéntica.
4. Abrir el email en otro navegador/dispositivo. El destino debe usar
   localhost y terminar en `/restablecer-clave` sin conservar códigos en la URL.
5. Probar menos de seis caracteres y contraseñas diferentes; luego guardar una
   válida. Iniciar sesión con la nueva contraseña y verificar que la vieja falla.
6. Volver a abrir el mismo enlace: debe mostrar «Este enlace ya no es válido».
   También probar un código inválido y `/restablecer-clave` sin sesión.
7. Verificar que el login con Google y el login tradicional siguen funcionando.
8. Tocar Contacto desde footer y páginas legales. Probar anónimo con Email, y
   con WhatsApp / teléfono. Verificar obligatoriedad según método y pedido corto.
9. Enviar una consulta; revisar su fila OPEN en `private.contact_requests` mediante
   el dashboard/SQL autorizado de Supabase. El user_id anónimo debe ser NULL.
10. Repetir logueado: revisar precarga, editar los datos y comprobar que el perfil
    original no cambia. El user_id debe corresponder a la sesión validada.
11. Sin Resend, comprobar que la consulta igualmente se guarda. Con Resend
    configurado, comprobar entrega y contenido. Con una API key de prueba inválida,
    la consulta debe seguir guardada y mostrar éxito, sin errores internos.
12. En una prueba manual controlada, llenar el honeypot: no debe aparecer una fila.
    Enviar seis consultas con los mismos datos en una hora: la sexta debe mostrar
    el límite sin crear otra fila. No automatizar esta prueba.
13. Con las credenciales públicas anon/authenticated, intentar leer la tabla o
    ejecutar la RPC: debe estar denegado. Verificar que el destinatario privado
    no aparece en HTML, respuestas del endpoint ni bundles del navegador.

## Prueba manual en cercaya.com.ar

1. Configurar las cuatro variables privadas en el entorno Production de Vercel,
   desplegar estos cambios y comprobar que el delta está aplicado al mismo proyecto.
2. Verificar el dominio remitente en Resend y configurar Custom SMTP para poder
   probar recuperación con destinatarios reales.
3. Desde `https://cercaya.com.ar/login` en una PC, solicitar recuperación y abrir
   el email desde un celular. Comprobar que no redirige a localhost ni al dominio antiguo.
4. Reabrir el enlace consumido y verificar el estado inválido. Probar login con
   nueva contraseña y Google; revisar móvil además de escritorio.
5. Enviar contacto anónimo y autenticado; confirmar filas OPEN y recepción del
   email privado. Probar ambos métodos preferidos y la referencia corta de pedido.
6. Comprobar enlaces legales/footer y ausencia del destinatario privado en cliente.
   Si falla email, confirmar el registro guardado antes de volver a enviar para
   evitar duplicar consultas manualmente.

## Archivos de esta etapa

- `.env.example`
- `SUPPORT_SETUP.md`
- `supabase/contact-support.sql`
- `src/app/recuperar-clave/page.tsx`
- `src/app/restablecer-clave/page.tsx`
- `src/app/contacto/page.tsx`
- `src/app/api/contacto/route.ts`
- `src/app/auth/confirm/route.ts`
- `src/components/support/password-support.tsx`
- `src/components/support/contact-form.tsx`
- `src/components/support/support.module.css`
- `src/lib/support/contact.ts`
- `src/lib/support/contact-server.ts`
- `src/components/auth/auth-form.tsx`
- `src/components/home/footer.tsx`
- `src/app/privacidad/page.tsx`
- `src/app/terminos/page.tsx`
- `src/app/reglas-comercios/page.tsx`
- `src/types/database.ts`

# Ubicación de Pedido Abierto y distancia privada en Radar

Esta etapa continúa los diez archivos que quedaron guardados antes de la interrupción. No modifica mapas, logística, catálogo público, reservas ni las migraciones SQL anteriores. La revisión fue por lectura de código: no se ejecutaron pruebas, build, lint, typecheck, navegador ni SQL remoto. La carpeta no tiene un repositorio Git disponible para obtener un diff.

## Único SQL que debés ejecutar

1. En el proyecto Supabase existente, abrí **SQL Editor → New query**.
2. Pegá el contenido completo de `supabase/request-location-radar.sql`, desde `begin;` hasta `commit;`.
3. Ejecutá **Run** y esperá que termine sin errores antes de probar la app.

No vuelvas a ejecutar `schema.sql`, `seed.sql`, `request-rls.sql`, `radar-offer-rls.sql` ni `realtime.sql`. Tampoco hace falta repetir el SQL de ubicación del comercio si esa etapa ya está instalada.

El nuevo archivo actualiza `create_my_request` con dos parámetros opcionales, reemplaza el retorno de `read_radar` para incluir `distance_km`, agrega un helper privado de Haversine, refuerza SELECT de requests y aplica el mismo límite de radio al enviar ofertas. No crea columnas ni instala PostGIS. El reemplazo de funciones ocurre en una transacción, sin `CASCADE`.

## Qué quedó implementado

- En `/pedido/nuevo`, **¿Dónde lo necesitás?** reutiliza el proveedor y la geolocalización existentes. Una ubicación local disponible aparece seleccionada y puede desmarcarse. Si no existe, un botón permite solicitarla explícitamente. Se puede publicar sin ubicación y ante un permiso rechazado.
- Publicar con la casilla seleccionada envía las coordenadas al pedido privado. Sin selección envía ambas como NULL. Desmarcarla no borra la ubicación local usada por el catálogo.
- La ubicación queda fijada al publicar. El detalle y la confirmación muestran **Ubicación compartida** o **Sin ubicación compartida**, junto al radio, sin coordenadas. Editarla queda para otra etapa.
- Los reintentos conservan el mismo identificador, datos y consentimiento. Ante una respuesta de red incierta, la interfaz muestra la elección original y evita editar ese intento; cambiar la ubicación del header no cambia lo enviado.
- Radar muestra distancia, urgencia y radio; permite filtros de hasta 5 km, hasta 10 km y dentro del radio solicitado. Los filtros comparan el valor del servidor sin recalcular Haversine. Excluyen pedidos con distancia NULL.
- **Más cerca** ordena por distancia antes que por categoría, con distancias desconocidas al final. Se deshabilita junto con los filtros geográficos cuando no hay distancias disponibles.
- Un comercio sin coordenadas recibe el aviso y enlace **Configurar ubicación**. Puede ver pedidos sin ubicación; no recibe pedidos ubicados cuyo radio no pueda comprobarse.
- Los pedidos sin ubicación conservan la priorización por categorías y muestran **Distancia no disponible**. No se presentan como pedidos cercanos.
- Realtime conserva el aviso mínimo existente. El cliente relee `read_radar` y recibe la distancia autorizada. Un aviso puede llegar también a comercios fuera del radio, pero la reconsulta no devuelve el pedido.

## Privacidad y cálculo

`buyer_id` se deriva de `auth.uid()` en `create_my_request`; no es un parámetro del frontend. La función valida coordenadas emparejadas y dentro de sus rangos. RLS limita las filas completas de `requests` al comprador propietario, incluso si otra política permisiva intentara ampliar SELECT. Los permisos existentes sólo permiten actualizar el estado, no las coordenadas de un pedido.

`read_radar` usa `SECURITY DEFINER`, `search_path` vacío, autorización por `auth.uid()` y permiso EXECUTE sólo para autenticados. Obtiene el comercio activo de la sesión: no acepta un business_id elegido por el cliente. Su retorno enumera los campos permitidos y no incluye buyer_id, latitude, longitude ni datos personales del comprador.

Haversine se calcula **en PostgreSQL**, en `private.request_distance_km`, con radio terrestre de 6371 km. El helper no tiene EXECUTE para clientes. La distancia en línea recta se filtra sin redondear con `distance_km <= requests.radius_km` antes de paginar, también al consultar por UUID. `create_my_offer` vuelve a comprobar ese límite dentro de su transacción.

El navegador del comercio sólo recibe `distance_km` y lo formatea como `850 m` o `3,4 km`. Los mensajes del canal `merchant-radar` siguen siendo `{entity: "radar", operation: "REFRESH"}`, sin filas ni coordenadas. El comprador sí puede leer su propia fila completa. La restricción es frente a otras cuentas, no frente al administrador del proyecto.

## Prueba manual breve

Usá cuentas distintas para comprador, comercio cercano y comercio lejano, en navegadores o perfiles separados. Para geolocalización desde celular usá una URL HTTPS accesible; localhost sólo sirve en el dispositivo que ejecuta la app. No escribas direcciones ni coordenadas en el título o la descripción de los pedidos de prueba.

1. **Preparación:** ejecutá el nuevo SQL. Configurá desde `/comercio/editar` la ubicación real de dos comercios activos: uno a menos de 10 km del comprador y otro a más de 10 km. Guardá estando físicamente en cada local. Dejá ambos Radar abiertos, con filtros **Todos** y **Cualquier distancia**.
2. **Comprador:** en `/pedido/nuevo`, compartí ubicación o dejá marcada la ubicación local existente. Usá un título identificable, como `Térmica bipolar prueba ubicación`, seleccioná categoría y radio **10 km**, y publicá. En el detalle debe decir **Ubicación compartida** y mostrar el radio.
3. **Comercio cercano / Realtime:** el pedido debe aparecer sin recargar, con **A … km**. Comprobá los filtros de 5 y 10 km según la distancia y **Dentro del radio solicitado**. Con varios pedidos, probá **Más cerca**.
4. **Comercio lejano:** el pedido no debe aparecer ni al tocar **Actualizar**. Abrir `/comercio/oportunidades/UUID-DEL-PEDIDO/responder` tampoco debe mostrar el formulario de oferta autorizado.
5. **Sin ubicación:** publicá otro pedido desmarcando **Usar mi ubicación actual**. Debe decir **Sin ubicación compartida** en su detalle. Ambos comercios pueden verlo con **Distancia no disponible**. Queda excluido al activar filtros geográficos y al final del orden Más cerca.
6. **Comercio sin coordenadas:** con una cuenta cuyo comercio aún tenga coordenadas NULL, abrí Radar. Debe mostrar el aviso **Configurá la ubicación…** y el enlace a editar. Puede ver el pedido sin ubicación, pero no el pedido ubicado de la prueba anterior.

### Comprobación de privacidad desde la sesión comercial

1. En las herramientas de desarrollo de TU navegador, abrí **Network**, limpiá el historial de solicitudes y luego actualizá Radar. Usá una sesión comercial distinta del comprador; no uses SQL Editor como prueba de RLS porque tiene privilegios administrativos.
2. Inspeccioná la respuesta de `POST /rest/v1/rpc/read_radar`: los pedidos deben tener `distance_km` y carecer de `latitude`, `longitude`, `buyer_id`, teléfono o correo del comprador. Las coordenadas del comercio propio que aparecen en otras solicitudes son públicas y no son las del pedido.
3. En la conexión WebSocket de Realtime, al publicar otro pedido, el evento `change` del canal `merchant-radar` debe contener sólo `entity: radar` y `operation: REFRESH`. La siguiente llamada a `read_radar` debe proporcionar el resultado autorizado.
4. Para verificar la lectura directa, usá la opción de tu navegador **Edit and Resend / Editar y reenviar** sobre una solicitud autenticada al REST de Supabase. Conservá las cabeceras de la sesión comercial, cambiá a método GET, quitá el cuerpo y usá la misma base con la ruta `/rest/v1/requests?select=id,latitude,longitude&id=eq.UUID-DEL-PEDIDO`. Debe devolver una lista vacía, nunca la fila del comprador. No copies ni compartas tokens. Si tu navegador no permite editar solicitudes, podés hacer esta comprobación con su cliente REST habitual usando exclusivamente la sesión comercial.
5. Para comprobar también el filtro por UUID, reenviá `read_radar` como POST con cuerpo `{"p_request_id":"UUID-DEL-PEDIDO","p_offset":0,"p_limit":100}`. Desde la sesión lejana debe devolver `[]`; desde la cercana devuelve el pedido sin coordenadas.

## Archivos de esta etapa

### Creados

- `supabase/request-location-radar.sql`
- `src/components/requests/request-location.tsx`
- `REQUEST_LOCATION_RADAR_SETUP.md`

### Modificados

- `src/components/requests/new-request.tsx`
- `src/components/requests/buyer-request-common.tsx`
- `src/components/requests/real-offer-form.tsx`
- `src/components/radar/radar.tsx`
- `src/components/radar/opportunity-card.tsx`
- `src/components/radar/use-live-radar.ts`
- `src/lib/real-radar.ts`
- `src/types/database.ts`

En la continuación se conservaron los diez archivos previos. Sólo se ajustó la presentación del consentimiento durante reintentos en `new-request.tsx` y `request-location.tsx`, y se agregó esta guía. Queda pendiente la ejecución manual del SQL y tu prueba funcional.

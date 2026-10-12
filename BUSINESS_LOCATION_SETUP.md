# Ubicación canónica de comercios

## Aplicación manual

1. Confirmar que las etapas vigentes de comercio/sociales/checkout y `hyperlocal-marketplace.sql` ya están aplicadas. No repetir SQL históricos.
2. Ejecutar únicamente `supabase/business-location-canonical.sql` desde Supabase SQL Editor y desplegar el código asociado. El delta no realiza backfill de city ni consulta Geoapify.
3. Mantener `NEXT_PUBLIC_GEOAPIFY_API_KEY` en localhost/Vercel. Es la misma clave pública existente; revisar sus restricciones de dominio para ambos entornos. No hay claves hardcodeadas ni otro proveedor.

## Modelo

Se conservan `city` (localidad), `address`, `latitude` y `longitude`. Se agregan `province`, `province_code`, `country_code` y `location_precision`.

- `province_code`: jurisdicción argentina de la lista fija, `province`: nombre correspondiente, `country_code`: AR.
- `DEVICE`: punto obtenido del dispositivo; continúa siendo una ubicación aproximada por GPS.
- `NONE`: localidad seleccionada, sin punto del comercio. No se guarda el centroide de Geoapify y no aparece dentro de un radio con comprador geolocalizado.
- `LEGACY`: coordenadas preexistentes, conservadas; no se inventa su precisión.

La UI exige seleccionar la localidad o resolverla desde coordenadas. PostgreSQL valida jurisdicción/nombre/país, longitudes, coordenadas y coherencia de la estructura, también en escrituras directas. No certifica contra Geoapify que un texto arbitrario exista: la fuente canónica es la selección del proveedor, como se pidió. No hay un padrón de localidades ni una llamada externa desde PostgreSQL.

## Caso Anizacate → Anisacate

1. Usar el comercio QA que ya tenga coordenadas válidas en Anisacate y `city = Anizacate`.
2. Abrir Editar comercio. Esperar la resolución; debería mostrar Anisacate / Córdoba y un aviso de ubicación detectada. Si el proveedor no puede resolver ambos valores, mantiene los datos actuales y muestra error.
3. Antes de guardar, cerrar y reabrir: la base conserva la localidad anterior. Abrir el formulario nunca escribe.
4. Guardar. Verificar `city = Anisacate`, `province = Córdoba`, `province_code = AR-X`, `country_code = AR`, mismas coordenadas y mismo slug.
5. Abrir la tienda: muestra Anisacate, Córdoba. Con comprador geolocalizado, los productos se filtran por Haversine y radio, no por city.
6. Estando físicamente en el comercio, probar Usar mi ubicación actual: solicita el punto, resuelve localidad/provincia y prellena; persiste al guardar.

## Otros escenarios manuales

- Crear comercio: Córdoba → escribir Ani → seleccionar Anisacate → dirección. No permite guardar texto escrito sin selección. Sin dispositivo no se crean coordenadas; las búsquedas con radio requieren configurarlas desde el local.
- Cambiar provincia o seleccionar otra localidad elimina las coordenadas anteriores del formulario; sólo se persiste al guardar, evitando conservar un punto del lugar previo.
- Teclear Anizacate sin elegir sugerencia y pulsar Guardar: bloqueado. El proveedor puede sugerir Anisacate, pero la normalización nunca corrige ortografía.
- Probar flechas/Enter/Escape/Tab en autocomplete, búsqueda sin resultados y error temporal del proveedor. Un comercio existente puede guardar otros datos manteniendo exactamente su ubicación previa si la resolución falla y no la modifica.
- Cambiar localidad mientras hay una respuesta pendiente: esa respuesta anterior no debe reemplazar la nueva selección.
- Fallback textual del comprador: un estado conocido sin coordenadas necesita localidad y provinciaCode válidos. Alta Gracia / AR-X coincide con comercios canonizados de Alta Gracia / AR-X; la misma localidad con otro código no coincide. Sin provincia no hay fallback textual.
- El flujo habitual del comprador sigue guardando coordenadas más localidad/provincia en el navegador. No se agregó un selector textual del comprador. Los registros antiguos sin provincia conservan sus coordenadas y se completan en la próxima actualización explícita de ubicación; no se reconsulta Geoapify en cada pantalla.
- Revisar mobile: select ancho completo, sugerencias táctiles y formulario en una columna.

Referencia del proveedor: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/

No se ejecutaron SQL remoto, navegador, build, lint completo ni E2E. Chequeo estático TypeScript realizado una vez con `npx tsc --noEmit`: PASS. Casos de proveedor/DB quedan para validación manual.

# Dirección inteligente — etapa 2

Aplicar manualmente `supabase/business-address-geocoding.sql` después de `business-location-canonical.sql`. No repetir ni modificar SQL históricos. Mantener `NEXT_PUBLIC_GEOAPIFY_API_KEY` actual y las restricciones de dominios correspondientes. No hay otra dependencia ni mapas.

El delta permite ADDRESS además de DEVICE/NONE/LEGACY. Conserva permisos, dueño, pagos, categorías, slug y guardado social existentes. No ejecuta un backfill ni consulta un proveedor desde PostgreSQL. Ante un cliente que cambia address omitiendo coordenadas, el RPC invalida el punto anterior. El frontend invalida el punto inmediatamente al modificar el texto.

## Pruebas manuales

1. **Desde otra ciudad:** abrir Crear o Editar; elegir Córdoba, seleccionar Anisacate y escribir Av. Los Aromos 350. No pulsar ubicación actual si no se está físicamente en el comercio.
2. **Dirección válida:** esperar las sugerencias y elegir la coincidencia de la localidad. Debe completar address, city, provincia/código, AR, coordenadas y ADDRESS en el formulario. Guardar y comprobar ubicación en DB, conservando el slug en edición. Si Geoapify no tiene ese número con suficiente confianza, probar otra dirección real cubierta: no se garantiza cobertura de una dirección particular.
3. **Dirección inválida:** escribir Calle sin nombre lote 14. Si no hay coincidencia precisa, conservar el texto descriptivo y guardar: coordenadas NULL, NONE y aviso de falta de punto. No usar ciudad/barrio/código postal como punto del negocio.
4. **Cambio manual:** abrir un comercio con punto válido y cambiar Belgrano 100 a Belgrano 200, sin elegir sugerencia. Debe mostrar punto pendiente; al guardar, no conservar coordenadas anteriores. Si se selecciona una dirección precisa después, guarda el nuevo punto.
5. **Cambio de provincia:** Córdoba → Santa Fe. Debe borrar localidad, dirección y punto del formulario. Elegir la nueva localidad y dirección antes de guardar.
6. **Cambio de localidad:** seleccionar una localidad diferente. Se descarta dirección/punto anteriores. Seleccionar nuevamente la misma localidad no borra el punto por abrir o confirmar el mismo lugar.
7. **Dispositivo:** estando en el negocio, Usar mi ubicación actual obtiene su punto y localidad/provincia. Completa dirección sólo si la respuesta incluye una dirección postal aceptable; guarda DEVICE, sin reemplazar el punto por el resultado del proveedor.
8. **Conservación:** abrir/cerrar un comercio existente sin editar no escribe ni borra coordenadas. Un error de Geoapify no borra datos por sí mismo. Los cambios manuales sí invalidan el punto aunque la búsqueda falle, porque ya no corresponde al texto nuevo.
9. **Accesibilidad/mobile:** flechas, Enter, Escape, Tab y selección táctil. Sugerencias en el flujo del formulario, con scroll interno y textos que pueden envolver.

Se aceptan building/housenumber/address o amenity con calle+número, confianza >=0.9, punto válido y localidad/provincia coincidentes. Cuando existe confidence_building_level, también debe ser >=0.9. Se rechaza street sin punto de edificio: criterio conservador para no usar el centro de una calle larga.

Referencia: https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/

No se ejecutan SQL remoto, navegador, E2E, build ni lint completo. La cobertura real del proveedor y el guardado SQL requieren las pruebas manuales anteriores.

# Límite de productos activos

Ejecutar manualmente supabase/product-active-limit.sql después de los SQL comerciales actuales y antes de publicar este frontend. No se ejecutó SQL remoto.

- Máximo 30 productos activos por comercio; STOCKED y ON_DEMAND cuentan igual.
- Stock cero también consume cupo mientras active=true. No se cambian unidades de stock.
- Los inactivos no consumen cupo. La desactivación o eliminación libera un lugar.
- Los comercios que ya superan 30 conservan productos y pueden editarlos o desactivarlos. No pueden sumar activos hasta bajar de 30.
- El trigger cubre save_my_product, manage_my_product, actualizaciones directas y reactivaciones de administración. No hay excepción administrativa al límite.
- La tabla privada mantiene un contador transaccional; un UPDATE condicional serializa el consumo del último cupo. Si falla la transacción se revierte también el contador.
- No se exponen tablas privadas ni se cambian firmas de RPC ni policies existentes. Se habilita RLS sin policies en la nueva tabla privada.
- El frontend consulta el total activo sin depender de la página actual. El contador visible puede quedar temporalmente desactualizado entre pestañas; PostgreSQL decide siempre.

## Prueba manual (comercio QA)

1. Comprobar el contador en Mis productos, incluida una segunda página.
2. Con 29 activos, publicar uno: debe quedar en 30.
3. Intentar otro desde otra pestaña o desde una URL directa: debe bloquearse con mensaje amigable.
4. Editar nombre, precio o stock de un activo con cupo completo: debe seguir permitido.
5. Desactivar uno: el contador baja y se permite publicar o reactivar otro.
6. Con 29, enviar dos altas simultáneas: sólo una debe quedar activa. La otra debe fallar sin crear un producto adicional.
7. Verificar que una reactivación desde edición también respete el límite.
8. Si existían más de 30, confirmar que se conservan y que se pueden desactivar sin bloqueo.

No se eliminan datos históricos ni se modifica el catálogo público.

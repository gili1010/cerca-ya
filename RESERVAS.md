> Documento histórico de la demo local. La implementación vigente está en [RESERVATION_SETUP.md](RESERVATION_SETUP.md).

# Reservas locales de productos publicados

Se conserva el diseño existente y se agrega el recorrido producto → reserva pendiente → confirmación del comercio → lista → completada. No hay backend, autenticación real, pagos, IA ni comunicación con comercios reales.

## Archivos creados

Modelo, comprador simulado y reglas:

- `src/types/reservations.ts`
- `src/data/buyer.ts`
- `src/lib/reservation-domain.ts`

Componentes reutilizables:

- `src/components/reservations/reservation-common.tsx`: resumen, producto, precios, estados y progreso.
- `src/components/reservations/product-stock.tsx`: stock local del catálogo y del detalle.
- `src/components/reservations/reservation-form.tsx`: cantidad, modalidad, comprador y confirmación.
- `src/components/reservations/reservation-confirmation.tsx`: comprobante de reserva enviada.
- `src/components/reservations/reservation-list.tsx`: listas de comprador y comercio, con filtros.
- `src/components/reservations/reservation-detail.tsx`: detalle, cancelación y gestión del comercio.

Rutas:

- `src/app/producto/[id]/page.tsx`: reutiliza el detalle existente; `/productos/[id]` sigue funcionando.
- `src/app/producto/[id]/reservar/page.tsx`
- `src/app/reservas/page.tsx`
- `src/app/reserva/[id]/page.tsx`
- `src/app/reserva/[id]/confirmacion/page.tsx`
- `src/app/comercio/reservas/page.tsx`
- `src/app/comercio/reserva/[id]/page.tsx`
- `RESERVAS.md`: esta documentación.

## Archivos modificados

- `src/types/requests.ts`: incorpora reservas e inventario al modelo local existente.
- `src/lib/request-domain.ts`: restaura los nuevos campos conservando pedidos y ofertas anteriores.
- `src/lib/request-store.ts`: reutiliza la persistencia, eventos entre pestañas y manejo de errores; agrega acciones de reserva, vencimiento al leer y stock. Las operaciones de reserva usan un bloqueo del navegador cuando está disponible para serializar confirmaciones simultáneas.
- `src/lib/products.ts`: agrega `deliveryPrice` opcional y una tarifa de envío demo de $2.500 a los productos con entrega.
- `src/app/productos/[id]/page.tsx`: muestra stock local actualizado.
- `src/components/details/fulfillment-options.tsx`: conecta Reservar y conserva la modalidad seleccionada.
- `src/components/details/demo-notice.tsx`: aclara el alcance local de las reservas.
- `src/components/home/product-card.tsx`: refleja el stock local en la card.
- `src/components/home/header.tsx`: acceso a Mis reservas.
- `src/components/home/home-dialogs.tsx`: accesos de comprador y comercio desde Cuenta en móvil.
- `src/components/requests/request-shell.tsx`: navegación entre pedidos y reservas.
- `src/app/workflows.css`: estilos de reservas con la paleta y componentes existentes.

## Persistencia y reglas

Se usa la misma clave `cercaya.pedidos.v1`. Las reservas y las cantidades de inventario se guardan juntas, sin borrar pedidos u ofertas previos. El comprador de prueba es Cliente Demo, teléfono 3510000000. El primer identificador disponible es RES-1001.

- PENDING: no descuenta stock. Vence 30 minutos después de crearse.
- CONFIRMED: descuenta unidades una sola vez, al confirmar el comercio.
- READY: producto listo para retirar o enviar, según la modalidad.
- COMPLETED: el comercio registró la entrega.
- CANCELLED: rechazo del comercio mientras está pendiente, o cancelación del comprador mientras está pendiente o confirmada. Una cancelación confirmada devuelve sus unidades una sola vez.
- EXPIRED: pendiente cuyo vencimiento pasó. No descuenta stock.

Los vencimientos se procesan al entrar a una vista que lee el almacén, al volver a la pestaña, al recibir cambios de otra pestaña y antes de una acción. No hay temporizador de vencimiento en segundo plano.

El total conserva los precios del momento de la reserva. El retiro no tiene costo; el envío usa la tarifa simulada. Un producto sin stock o sin modalidad disponible hoy no admite una nueva reserva. El comercio no puede confirmar si la cantidad supera el stock actual.

## Prueba manual

Usá el mismo navegador y origen (`http://127.0.0.1:3000`) en ambas pestañas. No combines `localhost` con `127.0.0.1`, porque tienen almacenamientos distintos.

1. **Crear:** entrá a `/producto/taladro`, tocá **Reservar**, elegí cantidad y modalidad. Probá los límites de − y +. Para dos taladros con envío, el total inicial es $172.300; con retiro, $169.800. Confirmá y anotá el ID. Debe aparecer **Reserva enviada**, pendiente de confirmación, sin descuento de stock.
2. **Ver como comprador:** tocá **Ver mi reserva** y visitá `/reservas`. Recargá para comprobar persistencia. Dejá el detalle abierto en la primera pestaña.
3. **Confirmar como comercio:** abrí `/comercio/reservas` en una segunda pestaña. Filtrá por Ferretería Norte, abrí la reserva y tocá **Confirmar reserva**. Debe pasar a confirmada en ambas pestañas y descontar la cantidad reservada del stock visible.
4. **Marcar lista:** en el detalle del comercio, tocá **Marcar como lista**. El comprador debe ver lista para retirar o enviar. Ya no debe ofrecer cancelación.
5. **Completar:** tocá **Marcar como entregada**. Debe quedar completada, con fecha de entrega y sin un segundo descuento de stock.
6. **Cancelar:** creá otra reserva y cancelala desde el comprador mientras está pendiente: no debe cambiar el stock. Creá una más, confirmala como comercio y cancelala desde el comprador antes de marcarla lista: debe devolver exactamente las unidades descontadas. Recargar o volver a abrirla no debe devolverlas otra vez.
7. **Falta de stock:** usá un producto con stock, por ejemplo `/producto/lampara`. Creá dos reservas pendientes, cada una por todo el stock disponible. Confirmá la primera como comercio. Intentá confirmar la segunda: debe mostrar **“No hay stock suficiente para confirmar esta reserva.”**, seguir pendiente y mantener el stock en cero. Si cancelás la primera desde el comprador mientras sigue confirmada, su stock vuelve y permite confirmar la segunda.
8. **Rechazo y vencimiento:** rechazá una nueva reserva pendiente desde el comercio: debe quedar cancelada sin descuento. Para vencimiento, dejá otra pendiente más de 30 minutos y recargá o volvé a la pestaña: debe figurar vencida sin descuento de stock.

No se ejecutaron pruebas automáticas, build, lint, verificaciones visuales ni navegador para esta implementación, por indicación del usuario. La comprobación funcional queda a cargo de esta prueba manual.


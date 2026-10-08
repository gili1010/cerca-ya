import type { BusinessRow } from "@/types/database";
import { isCoordinates } from "./location";
export function merchantOnboardingSteps(business: BusinessRow, publicProducts: number) {
  const published = Math.min(5, publicProducts);
  return [
    { id: "created", title: "Tienda creada", complete: true, detail: "", action: "Ver mi comercio", href: "/comercio/mi-negocio" },
    { id: "location", title: "Ubicación configurada", complete: isCoordinates(business), detail: "Permití que clientes cercanos encuentren tu negocio.", action: "Configurar ubicación", href: "/comercio/editar#business-location-title" },
    { id: "logo", title: "Logo cargado", complete: Boolean(business.logo_url?.trim()), detail: "Hacé que tu tienda sea fácil de reconocer. La portada es opcional.", action: "Agregar logo", href: "/comercio/mi-negocio#mi-tienda" },
    { id: "products", title: published === 5 ? "Catálogo inicial listo" : "Publicá tus primeros 5 productos", complete: published === 5, detail: `${published} de 5 publicados. Cuantos más productos publiques, más posibilidades tenés de aparecer en búsquedas.`, action: "Publicar producto", href: "/comercio/productos/nuevo" },
    { id: "delivery", title: "Formas de entrega configuradas", complete: business.pickup_enabled || business.delivery_enabled, detail: "Indicá cómo pueden recibir sus pedidos tus clientes.", action: "Configurar entrega", href: "/comercio/editar#business-delivery" },
    { id: "payment", title: "Formas de pago configuradas", complete: business.accepts_cash || business.accepts_transfer, detail: "Configurá efectivo o transferencia para que sepan cómo pagarte.", action: "Configurar pagos", href: "/comercio/editar#business-payment" },
    { id: "share", title: business.store_shared_at ? "Tienda compartida" : "Compartí tu tienda", complete: Boolean(business.store_shared_at), detail: "Compartí tu tienda para empezar a recibir visitas.", action: "Compartir tienda", href: "/comercio/mi-negocio#compartir-tienda" },
  ];
}

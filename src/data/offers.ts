import type { Offer } from "@/types/requests";

export function createMockOffers(now: Date): Offer[] {
  const createdAt = new Date(now.getTime() - 3 * 60000).toISOString();
  return [
    { id: "OFE-1001", requestId: "PED-1001", businessId: "repuestos-centro", businessName: "Repuestos Centro", productName: "Sensor de cigüeñal compatible Ford Ka 2019", description: "Modelo compatible para motor 1.5. Consultá la referencia de tu pieza antes de reservar. Oferta simulada.", price: 28500, distanceKm: 4.2, pickupAvailable: true, deliveryAvailable: false, estimatedDelivery: "", alternative: false, createdAt, stockAvailable: true },
    { id: "OFE-1002", requestId: "PED-1001", businessId: "autopartes-sur", businessName: "Autopartes Sur", productName: "Sensor original", description: "Repuesto original de ejemplo. Coordinación de entrega dentro de la zona indicada.", price: 35900, distanceKm: 8.1, pickupAvailable: false, deliveryAvailable: true, estimatedDelivery: "Entrega hoy, entre 16:00 y 19:00", alternative: false, createdAt, stockAvailable: true },
    { id: "OFE-1003", requestId: "PED-1001", businessId: "repuestos-lopez", businessName: "Repuestos López", productName: "Alternativa compatible", description: "Alternativa al producto solicitado. Verificá compatibilidad con tu vehículo. Datos de ejemplo.", price: 24900, distanceKm: 11, pickupAvailable: true, deliveryAvailable: true, estimatedDelivery: "Dentro de 24 horas", alternative: true, createdAt, stockAvailable: true },
  ];
}

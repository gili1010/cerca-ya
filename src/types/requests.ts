export const requestCategories = ["Ferretería", "Electricidad", "Herramientas", "Pintura", "Automotor", "Tecnología", "Hogar", "Indumentaria", "Mascotas", "Bazar", "Otra"] as const;
export const neededWhenOptions = ["Lo necesito hoy", "Mañana", "Esta semana", "No tengo apuro"] as const;
export const radiusOptions = [5, 10, 20, 30] as const;
export type RequestStatus = "OPEN" | "CLOSED" | "CANCELLED";
export interface Request {
  id: string;
  buyerId: string;
  title: string;
  description: string;
  category: (typeof requestCategories)[number];
  neededWhen: (typeof neededWhenOptions)[number];
  radiusKm: (typeof radiusOptions)[number];
  status: RequestStatus;
  createdAt: string;
  offersCount: number;
  reservedOfferId?: string;
  approximateDistanceKm?: number;
  expiresAt?: string;
}
export type RequestInput = Pick<Request, "title" | "description" | "category" | "neededWhen" | "radiusKm">;
export interface Offer {
  id: string;
  requestId: string;
  businessId: string;
  businessName: string;
  productName: string;
  description: string;
  price: number;
  distanceKm: number;
  pickupAvailable: boolean;
  deliveryAvailable: boolean;
  estimatedDelivery: string;
  alternative: boolean;
  createdAt: string;
  stockAvailable: boolean;
  sourceProductId?: string;
}
export type OfferInput = Pick<Offer, "productName" | "description" | "price" | "pickupAvailable" | "deliveryAvailable" | "estimatedDelivery" | "alternative">;
export interface Business {
  id: string;
  name: string;
  distanceKm: number;
  whatsapp: string;
  businessCategories?: Request["category"][];
  catalogStoreId?: string;
}
export interface RequestDatabase {
  version: 1;
  requests: Request[];
  offers: Offer[];
  radarSeedVersion?: 1;
  // Optional for compatibility with already saved Pedido Abierto demos.
  reservations?: import("./reservations").Reservation[];
  inventory?: Record<string, number>;
}

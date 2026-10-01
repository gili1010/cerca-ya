export const reservationStatuses = ["PENDING", "CONFIRMED", "READY", "COMPLETED", "CANCELLED", "EXPIRED"] as const;
export type ReservationStatus = (typeof reservationStatuses)[number];
export type DeliveryType = "pickup" | "delivery";
export interface ReservationBuyer { id: string; name: string; phone: string }
export interface Reservation {
  id: string;
  buyerId: string;
  buyerName: string;
  buyerPhone: string;
  businessId: string;
  businessName: string;
  productId: string;
  productName: string;
  productImage: string;
  productSource?: "supabase";
  quantity: number;
  unitPrice: number;
  deliveryPrice: number;
  total: number;
  deliveryType: DeliveryType;
  status: ReservationStatus;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  readyAt: string | null;
  completedAt: string | null;
}
export type ReservationProductSnapshot = Pick<Product, "id" | "name" | "storeId" | "store" | "price" | "stock" | "image" | "pickupToday" | "deliveryToday" | "deliveryPrice" | "source">;
export interface ReservationInput { productId: string; quantity: number; deliveryType: DeliveryType; product?: ReservationProductSnapshot }
export interface ReservationData { reservations: Reservation[]; inventory: Record<string, number> }
import type { Product } from "@/lib/products";

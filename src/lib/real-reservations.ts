import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ReservationView } from "@/types/database";
import type { ReservationStatus } from "@/types/reservations";
import { isUuid } from "./real-offers";

export type ReservationAction = "confirm" | "cancel" | "ready" | "complete";
export function reservationStatus(row: ReservationView, now: number): ReservationStatus {
  return row.status === "PENDING" && Date.parse(row.expires_at) <= now ? "EXPIRED" : row.status;
}
export async function readReservations(client: SupabaseClient<Database>, seller: boolean, id?: string) {
  if (id && !isUuid(id)) return [];
  const rows: ReservationView[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.rpc("read_my_reservations", { p_seller: seller, p_reservation_id: id ?? null, p_offset: offset, p_limit: 100 });
    if (error) throw error;
    rows.push(...data);
    if (data.length < 100) return [...new Map(rows.map(row => [row.id, row])).values()];
  }
}
export function reservationError(error: { message?: string }, creating = false) {
  const message = error.message ?? "";
  if (message.includes("reservation_checkout_phone_invalid")) return "Revisá el teléfono: ingresá código de área y número de Argentina.";
  if (message.includes("reservation_checkout_address_required")) return "Completá la dirección y localidad de entrega.";
  if (message.includes("reservation_checkout_invalid")) return "Revisá tus datos de contacto, entrega y forma de pago.";
  if (message.includes("reservation_payment_unavailable")) return "El comercio ya no acepta esa forma de pago. Volvé al producto para actualizar las opciones.";
  if (message.includes("reservation_availability_unavailable")) return "Este producto a pedido no está disponible hoy. Consultá al comercio o actualizá el producto.";
  if (message.includes("reservation_confirm_stock_insufficient")) return "No hay stock suficiente para confirmar esta reserva.";
  if (message.includes("reservation_stock_insufficient")) return "No hay stock suficiente.";
  if (message.includes("reservation_product_unavailable")) return "Este producto ya no está disponible.";
  if (message.includes("reservation_state_changed")) return "Esta reserva ya cambió de estado.";
  if (message.includes("reservation_delivery_unavailable")) return "Esta modalidad ya no está disponible. Volvé al producto para actualizar las opciones.";
  if (message.includes("reservation_retry_mismatch")) return "Los datos del intento anterior cambiaron. Volvé a abrir el formulario.";
  return creating ? "No pudimos crear la reserva." : "No pudimos actualizar la reserva.";
}

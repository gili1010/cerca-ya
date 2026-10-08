import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DatabaseDeliveryType, ReservationItemView, ReservationOrderItemInput, ReservationView } from "@/types/database";
import type { ReservationStatus } from "@/types/reservations";
import { isUuid } from "./real-offers";
import { normalizeReservationCheckout, type ReservationCheckoutInput } from "./reservation-checkout";

export type ReservationAction = "confirm" | "cancel" | "ready" | "complete";
export function reservationStatus(row: ReservationView, now: number): ReservationStatus {
  return row.status === "PENDING" && Date.parse(row.expires_at) <= now ? "EXPIRED" : row.status;
}
export function reservationItems(row: ReservationView): ReservationItemView[] {
  if (row.items?.length) return row.items;
  // Preserve historical reservations and compatibility before the SQL delta is applied.
  return [{
    id: row.id, reservation_id: row.id, product_id: row.product_id, quantity: row.quantity,
    unit_price: row.unit_price, product_name_snapshot: row.product_name,
    inventory_mode_snapshot: row.inventory_mode, created_at: row.created_at,
    subtotal: row.quantity * row.unit_price, product_image: row.product_image, current_stock: row.current_stock,
  }];
}
export function reservationItemsSubtotal(row: ReservationView) {
  return row.items_subtotal ?? reservationItems(row).reduce((subtotal, item) => subtotal + item.subtotal, 0);
}
export interface ReservationOrderInput {
  id: string; items: readonly ReservationOrderItemInput[]; deliveryType: DatabaseDeliveryType; checkout: ReservationCheckoutInput;
}
// The caller retains the same ID and input when retrying an ambiguous response.
// Prices, business and inventory mode are resolved exclusively by the database.
export async function createReservationOrder(client: SupabaseClient<Database>, input: ReservationOrderInput) {
  return client.rpc("create_my_order", {
    p_reservation_id: input.id,
    p_items: input.items.map(item => ({ product_id: item.product_id, quantity: item.quantity })),
    p_delivery_type: input.deliveryType,
    p_checkout: normalizeReservationCheckout(input.checkout, input.deliveryType),
  });
}
export async function readReservations(client: SupabaseClient<Database>, seller: boolean, id?: string) {
  if (id && !isUuid(id)) return [];
  const rows: ReservationView[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.rpc("read_my_reservations", { p_seller: seller, p_reservation_id: id ?? null, p_offset: offset, p_limit: 100 });
    if (error) throw error;
    rows.push(...data.map(row => ({ ...row, items: reservationItems(row), items_subtotal: reservationItemsSubtotal(row) })));
    if (data.length < 100) return [...new Map(rows.map(row => [row.id, row])).values()];
  }
}
export function reservationError(error: { message?: string }, creating = false) {
  const message = error.message ?? "";
  if (message.includes("account_suspended")) return "Tu cuenta está suspendida.";
  if (message.includes("reservation_items_invalid")) return "Revisá los productos y sus cantidades para enviar el pedido.";
  if (message.includes("reservation_items_mixed_business")) return "Todos los productos del pedido deben pertenecer al mismo comercio.";
  if (message.includes("reservation_minimum_order_not_met")) return "El subtotal del pedido no alcanza la compra mínima del comercio.";
  if (message.includes("reservation_total_limit")) return "El importe del pedido supera el máximo permitido. Revisá las cantidades.";
  if (message.includes("reservation_checkout_phone_invalid")) return "Revisá el teléfono: ingresá código de área y número de Argentina.";
  if (message.includes("reservation_checkout_address_required")) return "Completá la dirección y localidad de entrega.";
  if (message.includes("reservation_checkout_invalid")) return "Revisá tus datos de contacto, entrega y forma de pago.";
  if (message.includes("reservation_payment_unavailable")) return "El comercio ya no acepta esa forma de pago. Volvé al producto para actualizar las opciones.";
  if (message.includes("reservation_availability_unavailable")) return "Uno o más productos a pedido no están disponibles hoy. Consultá al comercio o actualizá los productos.";
  if (message.includes("reservation_confirm_stock_insufficient")) return "Uno o más productos ya no tienen stock suficiente para confirmar el pedido. No se descontó ninguna unidad.";
  if (message.includes("reservation_stock_insufficient")) return "Uno o más productos no tienen stock suficiente.";
  if (message.includes("reservation_product_unavailable")) return "Uno o más productos ya no están disponibles.";
  if (message.includes("reservation_state_changed")) return "Esta reserva ya cambió de estado.";
  if (message.includes("reservation_delivery_unavailable")) return "Esta modalidad ya no está disponible. Volvé al producto para actualizar las opciones.";
  if (message.includes("reservation_retry_mismatch")) return "Los datos del intento anterior cambiaron. Volvé a abrir el formulario.";
  return creating ? "No pudimos crear la reserva." : "No pudimos actualizar la reserva.";
}

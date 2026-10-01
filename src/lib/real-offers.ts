import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, OfferRow, PublicOfferRow } from "@/types/database";

export const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export type RealOfferInput = Pick<OfferRow, "product_name" | "description" | "price" | "pickup_available" | "delivery_available" | "delivery_price" | "estimated_delivery" | "alternative">;
export const offerStatusLabels: Record<OfferRow["status"], string> = {
  PENDING: "Pendiente", ACCEPTED: "Aceptada", REJECTED: "Rechazada", WITHDRAWN: "Retirada", ACTIVE: "Pendiente", EXPIRED: "Vencida",
};
export function validateOffer(input: RealOfferInput) {
  if (input.product_name.trim().length < 3 || input.product_name.trim().length > 120) return "Escribí un producto de entre 3 y 120 caracteres.";
  if (input.description.trim().length < 3 || input.description.trim().length > 1000) return "Agregá una descripción de entre 3 y 1000 caracteres.";
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 9999999999.99) return "Ingresá un precio válido.";
  if (!input.pickup_available && !input.delivery_available) return "Elegí retiro o envío.";
  if (!Number.isFinite(input.delivery_price) || input.delivery_price < 0 || input.delivery_price > 9999999999.99) return "Ingresá un costo de envío válido.";
  if (input.estimated_delivery.trim().length > 120 || (input.delivery_available && !input.estimated_delivery.trim())) return "Indicá el tiempo estimado de entrega (hasta 120 caracteres).";
  return "";
}
export function offerError(error: { message?: string; code?: string }) {
  if (error.message?.includes("offer_request_unavailable")) return "Este pedido ya no acepta ofertas.";
  if (error.code === "23505") return "Ya enviaste una oferta para este pedido.";
  if (error.message?.includes("offer_product_unavailable")) return "El producto ya no está disponible para ofrecer. Revisá tu catálogo.";
  if (error.message?.includes("offer_invalid_input")) return "Revisá los datos y las opciones de retiro y envío de tu comercio.";
  if (error.message?.includes("offer_business_required")) return "Necesitás un comercio activo para enviar ofertas.";
  return "No pudimos enviar la oferta.";
}
export async function readRealOffers(client: SupabaseClient<Database>, requestId?: string, offerId?: string, seller = false) {
  if ((requestId && !isUuid(requestId)) || (offerId && !isUuid(offerId))) return [];
  const rows: PublicOfferRow[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.rpc("read_offers", { p_request_id: requestId ?? null, p_offer_id: offerId ?? null, p_seller: seller, p_offset: offset, p_limit: 100 });
    if (error) throw error;
    rows.push(...data);
    if (data.length < 100) return [...new Map(rows.map(row => [row.id, row])).values()];
  }
}
export function offerWhatsApp(offer: PublicOfferRow) {
  const phone = offer.business_whatsapp?.replace(/\D/g, "") ?? "";
  if (!/^\d{8,15}$/.test(phone)) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, recibí tu oferta por ${offer.product_name} en CercaYa.`)}`;
}

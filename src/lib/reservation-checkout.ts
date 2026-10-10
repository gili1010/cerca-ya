import type { DatabaseDeliveryType, PaymentMethod } from "@/types/database";
import { normalizeArgentinaPhone } from "./phone";

export const paymentLabels: Record<PaymentMethod, string> = {
  CASH: "Efectivo", TRANSFER: "Transferencia", ARRANGE: "A coordinar con el comercio",
};
export interface ReservationCheckoutInput {
  customer_name: string; customer_phone: string; delivery_address: string; delivery_city: string;
  delivery_reference: string; customer_notes: string; payment_method: PaymentMethod;
}
export const emptyReservationCheckout: ReservationCheckoutInput = {
  customer_name: "", customer_phone: "", delivery_address: "", delivery_city: "",
  delivery_reference: "", customer_notes: "", payment_method: "ARRANGE",
};
export function validateReservationCheckout(input: ReservationCheckoutInput, delivery: DatabaseDeliveryType) {
  if (!input.customer_name.trim() || input.customer_name.trim().length > 160) return "Ingresá tu nombre, hasta 160 caracteres.";
  if (!normalizeArgentinaPhone(input.customer_phone)) return "Ingresá un teléfono de Argentina con código de área y número, sin 0 ni 15.";
  if (delivery === "DELIVERY") {
    if (!input.delivery_address.trim() || input.delivery_address.trim().length > 240) return "Ingresá la dirección de entrega, hasta 240 caracteres.";
    if (!input.delivery_city.trim() || input.delivery_city.trim().length > 120) return "Ingresá la localidad de entrega, hasta 120 caracteres.";
    if (input.delivery_reference.trim().length > 500) return "La referencia puede tener hasta 500 caracteres.";
  }
  if (input.customer_notes.trim().length > 1000) return "Las notas pueden tener hasta 1000 caracteres.";
  if (!Object.hasOwn(paymentLabels, input.payment_method)) return "Seleccioná una forma de pago.";
  return null;
}
export function normalizeReservationCheckout(input: ReservationCheckoutInput, delivery: DatabaseDeliveryType) {
  return {
    customer_name: input.customer_name.trim(), customer_phone: normalizeArgentinaPhone(input.customer_phone) ?? "",
    delivery_address: delivery === "DELIVERY" ? input.delivery_address.trim() : null,
    delivery_city: delivery === "DELIVERY" ? input.delivery_city.trim() : null,
    delivery_reference: delivery === "DELIVERY" ? input.delivery_reference.trim() || null : null,
    customer_notes: input.customer_notes.trim() || null, payment_method: input.payment_method,
  };
}

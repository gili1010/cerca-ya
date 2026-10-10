import type { BusinessRow } from "@/types/database";
import { argentinaWhatsAppNumber } from "@/lib/phone";
import { normalizeSocialLink } from "./social-links";

export const deliveryRadii = [5, 10, 15, 20, 30] as const;
export type BusinessInput = Pick<BusinessRow, "name" | "description" | "pickup_enabled" | "delivery_enabled" | "delivery_radius_km" | "delivery_price" | "minimum_order"> & {
  whatsapp: string; city: string; address: string;
  accepts_cash: boolean; accepts_transfer: boolean; transfer_alias: string;
  instagram_url: string; facebook_url: string;
  latitude?: number; longitude?: number;
};
export const emptyBusiness: BusinessInput = {
  name: "", description: "", whatsapp: "", city: "", address: "", pickup_enabled: true, delivery_enabled: false,
  delivery_radius_km: 5, delivery_price: 0, minimum_order: 0,
  accepts_cash: true, accepts_transfer: false, transfer_alias: "",
  instagram_url: "", facebook_url: "",
};
export function normalizeBusiness(input: BusinessInput): BusinessInput {
  return { ...input, instagram_url: normalizeSocialLink(input.instagram_url, "instagram") ?? "", facebook_url: normalizeSocialLink(input.facebook_url, "facebook") ?? "", name: input.name.trim(), description: input.description.trim(), whatsapp: argentinaWhatsAppNumber(input.whatsapp) ?? "", city: input.city.trim(), address: input.address.trim(), transfer_alias: input.transfer_alias.trim(), delivery_radius_km: input.delivery_enabled ? input.delivery_radius_km : 0, delivery_price: input.delivery_enabled ? input.delivery_price : 0 };
}
export function validateBusiness(input: BusinessInput, categoryIds: string[]): string | null {
  if (normalizeSocialLink(input.instagram_url, "instagram") === undefined) return "Revisá el enlace de Instagram.";
  if (normalizeSocialLink(input.facebook_url, "facebook") === undefined) return "Revisá el enlace de Facebook.";
  if (!input.name.trim()) return "El nombre del comercio es obligatorio.";
  if (input.name.trim().length > 160) return "El nombre puede tener hasta 160 caracteres.";
  if (input.description.trim().length > 3000) return "La descripción puede tener hasta 3000 caracteres.";
  if (!argentinaWhatsAppNumber(input.whatsapp)) return "Ingresá un WhatsApp de Argentina con código de área y número (10 dígitos, sin 0 ni 15), o su formato internacional +54 9.";
  if (!input.city.trim() || input.city.trim().length > 120) return "Ingresá una ciudad o localidad de hasta 120 caracteres.";
  if (!input.address.trim() || input.address.trim().length > 240) return "Ingresá una dirección de hasta 240 caracteres.";
  if (input.transfer_alias.trim().length > 100) return "El alias puede tener hasta 100 caracteres.";
  if (!categoryIds.length) return "Seleccioná al menos una categoría.";
  if (!input.pickup_enabled && !input.delivery_enabled) return "Habilitá retiro o envío para tu comercio.";
  if (input.delivery_enabled && !deliveryRadii.includes(input.delivery_radius_km as (typeof deliveryRadii)[number])) return "Seleccioná un radio de entrega válido.";
  const prices = input.delivery_enabled ? [input.delivery_price, input.minimum_order] : [input.minimum_order];
  if (prices.some(value => !Number.isFinite(value) || value < 0 || value > 9999999999.99 || Math.abs(value * 100 - Math.round(value * 100)) > .001)) return "Ingresá importes válidos, desde 0 y con hasta dos decimales.";
  return null;
}
export function businessErrorMessage(error: unknown, edit: boolean): string {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : {};
  if (typeof record.message === "string" && record.message.includes("account_suspended")) return "Tu cuenta está suspendida.";
  const messages: Record<string, string> = {
    BUSINESS_INSTAGRAM_INVALID: "Revisá el enlace de Instagram.", BUSINESS_FACEBOOK_INVALID: "Revisá el enlace de Facebook.",
    AUTH_REQUIRED: "Iniciá sesión para guardar tu comercio.", PROFILE_REQUIRED: "No pudimos cargar tu perfil. Volvé a Mi cuenta e intentá nuevamente.",
    BUSINESS_NOT_OWNED: "No tenés permiso para modificar ese comercio.", BUSINESS_NAME_REQUIRED: "El nombre del comercio es obligatorio.",
    BUSINESS_PHONE_INVALID: "El WhatsApp no es válido.", BUSINESS_CITY_REQUIRED: "Ingresá la ciudad o localidad.",
    BUSINESS_ADDRESS_REQUIRED: "Ingresá la dirección.", BUSINESS_CATEGORY_REQUIRED: "Seleccioná al menos una categoría.",
    BUSINESS_CATEGORY_INVALID: "Alguna categoría ya no está disponible. Recargá el formulario.", BUSINESS_METHOD_REQUIRED: "Habilitá retiro o envío.",
    BUSINESS_RADIUS_INVALID: "Seleccioná un radio de entrega válido.", BUSINESS_PRICE_INVALID: "Revisá los importes ingresados.",
    BUSINESS_LOCATION_INVALID: "No pudimos guardar la ubicación. Volvé a obtenerla e intentá nuevamente.",
    BUSINESS_PAYMENT_INVALID: "Revisá los medios de pago y el alias ingresado.",
    BUSINESS_SLUG_IMMUTABLE: "El enlace de tu tienda es permanente y no puede modificarse.",
  };
  if (typeof record.message === "string" && messages[record.message]) return messages[record.message];
  if (record.code === "23505") return "Ya tenés un comercio registrado o el nombre no pudo asignarse. Volvé a Mi comercio.";
  if (record.code === "42501") return "No tenés permiso para guardar estos cambios. Revisá tu sesión.";
  return edit ? "No pudimos guardar los cambios del comercio. Intentá nuevamente." : "No pudimos crear el comercio. Intentá nuevamente.";
}


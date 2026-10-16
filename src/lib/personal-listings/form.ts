import { normalizeArgentinaPhone } from "@/lib/phone";
import { provinceByCode } from "@/lib/argentina-provinces";
import type { OwnedPersonalListing, PersonalListingInput, PersonalItemCondition } from "@/types/personal-listings";

export interface PersonalArticleForm {
  title: string; description: string; categoryId: string; condition: PersonalItemCondition;
  price: string; negotiable: boolean; provinceCode: string; city: string;
  publicName: string; whatsapp: string; consent: boolean; renew: boolean;
}
export const emptyArticleForm = (): PersonalArticleForm => ({
  title: "", description: "", categoryId: "", condition: "USED", price: "", negotiable: false,
  provinceCode: "", city: "", publicName: "", whatsapp: "", consent: false, renew: false,
});
export function articleFormFromListing(listing: OwnedPersonalListing): PersonalArticleForm {
  return { title: listing.title, description: listing.description, categoryId: listing.category_id,
    condition: listing.item_condition, price: String(listing.price), negotiable: listing.negotiable,
    provinceCode: listing.province_code, city: listing.city, publicName: listing.seller_display_name,
    whatsapp: listing.contact_whatsapp ?? "", consent: listing.contact_method === "WHATSAPP", renew: false };
}
export function articlePrice(text: string): number | null {
  const value = text.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(value)) return null;
  const price = Number(value.replace(",", "."));
  return Number.isFinite(price) && price >= 0 && price <= 9999999999.99 ? price : null;
}
export function validateArticleForm(form: PersonalArticleForm, categories: readonly string[], contactRequired = false): string | null {
  if (!form.title.trim() || form.title.trim().length > 160 || /[\u0000-\u001f\u007f]/.test(form.title)) return "Escribí un título de hasta 160 caracteres.";
  if (form.description.length > 5000) return "La descripción puede tener hasta 5.000 caracteres.";
  if (!categories.includes(form.categoryId)) return "Elegí una categoría para tu artículo.";
  if (articlePrice(form.price) === null) return "Ingresá un precio válido, sin separadores de miles y con hasta dos decimales.";
  if (!provinceByCode(form.provinceCode)) return "Elegí la provincia donde se encuentra el artículo.";
  if (!form.city.trim() || form.city.trim().length > 120 || /[\u0000-\u001f\u007f]/.test(form.city)) return "Indicá una localidad de hasta 120 caracteres.";
  if (form.publicName.length > 120 || /[\u0000-\u001f\u007f]/.test(form.publicName)) return "El nombre público puede tener hasta 120 caracteres.";
  if (form.consent && !normalizeArgentinaPhone(form.whatsapp)) return "Ingresá un WhatsApp argentino con código de área, sin 0 ni 15.";
  if (contactRequired && (!form.consent || !normalizeArgentinaPhone(form.whatsapp))) return "Para publicar, ingresá un WhatsApp válido y autorizá que se muestre.";
  return null;
}
export function articleInput(form: PersonalArticleForm, listing: OwnedPersonalListing | null): PersonalListingInput {
  const price = articlePrice(form.price);
  if (price === null) throw new Error("Revisá el precio del artículo.");
  const phone = form.consent ? normalizeArgentinaPhone(form.whatsapp) : null;
  return { title: form.title.trim().replace(/\s+/g, " "), description: form.description,
    category_id: form.categoryId, price, negotiable: form.negotiable, item_condition: form.condition,
    city: form.city.trim().replace(/\s+/g, " "), province_code: form.provinceCode,
    seller_display_name: form.publicName.trim(), expires_at: form.renew ? null : listing?.expires_at ?? null,
    contact_method: form.consent ? "WHATSAPP" : "NONE", contact_whatsapp: phone ? `+${phone}` : null,
    contact_consent: form.consent };
}
export function listingMatchesInput(listing: OwnedPersonalListing, input: PersonalListingInput): boolean {
  return listing.title === input.title && listing.description === input.description && listing.category_id === input.category_id
    && listing.price === input.price && listing.negotiable === input.negotiable && listing.item_condition === input.item_condition
    && listing.city === input.city && listing.province_code === input.province_code && listing.seller_display_name === input.seller_display_name
    && listing.contact_method === input.contact_method && listing.contact_whatsapp === input.contact_whatsapp && listing.expires_at === input.expires_at;
}
export function personalArticleMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: Number.isInteger(value) ? 0 : 2 }).format(value);
}
export function articleUiError(cause: unknown, fallback = "No pudimos completar la acción. Volvé a intentar."): string {
  const message = cause instanceof Error ? cause.message : "";
  return /^(No |La |Esta |Tu |Revisá|Elegí|Ingresá|Para |Volvé|Ya |Iniciá|Escribí|Agregá|El |Formato)/.test(message) ? message : fallback;
}

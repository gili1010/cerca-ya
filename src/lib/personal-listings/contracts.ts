import type {
  OwnedPersonalListing, PersonalListingImage, PersonalListingPage, PersonalListingStatus,
  PublicPersonalListing, PersonalListingReport, PersonalListingAuditLog, PersonalListingPresentation,
} from "@/types/personal-listings";
import { provinceByCode } from "@/lib/argentina-provinces";

export const personalListingPageSize = 24;
export const personalListingBucket = "personal-listing-images";
export const personalListingSignedUrlSeconds = 600;
export const personalListingStatuses: readonly PersonalListingStatus[] = ["DRAFT", "PUBLISHED", "PAUSED", "SOLD", "WITHDRAWN"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const objectPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$/;

export function isPersonalListingId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}
export function isPersonalListingObjectPath(value: unknown, listingId?: string): value is string {
  return typeof value === "string" && objectPattern.test(value) && (!listingId || value.split("/")[0] === listingId.toLowerCase());
}
export function pageWindow(page = 0, pageSize = personalListingPageSize) {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50
    || !Number.isSafeInteger(page * pageSize) || page * pageSize > 2147483647) {
    throw new Error("No pudimos abrir esa página.");
  }
  return { offset: page * pageSize, limit: pageSize };
}
export function requireListingId(id: string): void {
  if (!isPersonalListingId(id)) throw new Error("Esta publicación no está disponible.");
}
export function requireRevision(revision: number): void {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new Error("Volvé a cargar la publicación antes de guardar.");
}

function invalidResponse(): never { throw new Error("No pudimos leer las publicaciones. Volvé a intentar."); }
export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalidResponse();
  return value as Record<string, unknown>;
}
function string(value: unknown): string { return typeof value === "string" ? value : invalidResponse(); }
function nullableString(value: unknown): string | null { return value === null ? null : string(value); }
function boolean(value: unknown): boolean { return typeof value === "boolean" ? value : invalidResponse(); }
function number(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : invalidResponse(); }
function uuid(value: unknown): string { return isPersonalListingId(value) ? value : invalidResponse(); }
function date(value: unknown): string {
  const text = string(value);
  return Number.isFinite(Date.parse(text)) ? text : invalidResponse();
}
function nullableDate(value: unknown): string | null { return value === null ? null : date(value); }

function parseImages(value: unknown, listingId: string): PersonalListingImage[] {
  if (!Array.isArray(value) || value.length > 5) return invalidResponse();
  const paths = new Set<string>();
  return value.map((entry, index) => {
    const image = record(entry);
    const path = image.object_path;
    if (!isPersonalListingObjectPath(path, listingId) || paths.has(path) || image.position !== index) return invalidResponse();
    paths.add(path);
    return { id: uuid(image.id), object_path: path, position: index };
  });
}

function presentation(value: unknown): PersonalListingPresentation {
  const row = record(value);
  const id = uuid(row.id);
  const condition = row.item_condition;
  const contact = row.contact_method;
  const phone = nullableString(row.contact_whatsapp);
  const provinceCode = string(row.province_code);
  const province = provinceByCode(provinceCode);
  const price = number(row.price);
  if ((condition !== "NEW" && condition !== "USED") || (contact !== "NONE" && contact !== "WHATSAPP")
    || row.currency !== "ARS" || row.country_code !== "AR" || !province || province.name !== row.province
    || price < 0 || price > 9999999999.99 || (contact === "NONE" ? phone !== null : !phone || !/^\+54(?:9)?[1-9]\d{9}$/.test(phone))) return invalidResponse();
  // Construir campos explícitos impide trasladar nuevas columnas privadas al frontend.
  return {
    id, category_id: uuid(row.category_id), category_name: string(row.category_name), category_slug: string(row.category_slug),
    title: string(row.title), description: string(row.description), price, currency: "ARS" as const,
    negotiable: boolean(row.negotiable), item_condition: condition,
    seller_display_name: string(row.seller_display_name), contact_method: contact, contact_whatsapp: phone,
    city: string(row.city), province: province.name, province_code: provinceCode, country_code: "AR" as const,
    created_at: date(row.created_at), updated_at: date(row.updated_at), published_at: nullableDate(row.published_at),
    expires_at: nullableDate(row.expires_at), images: parseImages(row.images, id),
  };
}

export function parsePublicPersonalListing(value: unknown): PublicPersonalListing {
  const row = record(value);
  const listing = presentation(value);
  if (row.status !== "PUBLISHED" || listing.contact_method !== "WHATSAPP" || !listing.contact_whatsapp
    || !listing.published_at || !listing.images.length) return invalidResponse();
  return { ...listing, status: "PUBLISHED", contact_method: "WHATSAPP", contact_whatsapp: listing.contact_whatsapp, published_at: listing.published_at };
}
export function parseOwnedPersonalListing(value: unknown): OwnedPersonalListing {
  const row = record(value);
  const listing = presentation(value);
  const status = row.status;
  if (status !== "DRAFT" && status !== "PUBLISHED" && status !== "PAUSED" && status !== "SOLD" && status !== "WITHDRAWN") return invalidResponse();
  const revision = number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) return invalidResponse();
  return { ...listing, status, owner_id: uuid(row.owner_id), revision, contact_consent_at: nullableDate(row.contact_consent_at),
    admin_blocked: boolean(row.admin_blocked), admin_block_reason: nullableString(row.admin_block_reason), expired: boolean(row.expired) };
}
export function parseListingPage<T>(value: unknown, parseItem: (item: unknown) => T): PersonalListingPage<T> {
  const row = record(value);
  const total = number(row.total); const offset = number(row.offset); const limit = number(row.limit);
  if (!Array.isArray(row.items) || !Number.isSafeInteger(total) || total < 0 || !Number.isInteger(offset) || offset < 0
    || !Number.isInteger(limit) || limit < 1 || limit > 50 || row.items.length > limit) return invalidResponse();
  return { items: row.items.map(parseItem), total, offset, limit };
}

export function parsePersonalListingReport(value: unknown): PersonalListingReport {
  const row = record(value);
  const reason = row.reason; const status = row.status;
  if ((reason !== "Información incorrecta" && reason !== "Artículo prohibido o inapropiado" && reason !== "Posible estafa"
    && reason !== "Contenido ofensivo" && reason !== "Otro") || (status !== "OPEN" && status !== "RESOLVED" && status !== "DISMISSED")) return invalidResponse();
  return { id: uuid(row.id), listing_id: uuid(row.listing_id), reporter_user_id: uuid(row.reporter_user_id), reason,
    details: string(row.details), status, created_at: date(row.created_at), resolved_at: nullableDate(row.resolved_at),
    resolved_by: row.resolved_by === null ? null : uuid(row.resolved_by), resolution_note: string(row.resolution_note) };
}
export function parsePersonalListingAuditLog(value: unknown): PersonalListingAuditLog {
  const row = record(value);
  const action = row.action;
  if (action !== "LISTING_BLOCKED" && action !== "LISTING_UNBLOCKED" && action !== "REPORT_RESOLVED" && action !== "REPORT_DISMISSED") return invalidResponse();
  return { id: uuid(row.id), admin_user_id: uuid(row.admin_user_id), listing_id: uuid(row.listing_id),
    report_id: row.report_id === null ? null : uuid(row.report_id), action, reason: string(row.reason), note: string(row.note), created_at: date(row.created_at) };
}

/** Sólo códigos controlados se traducen. Nunca devuelve message/details técnicos. */
export function personalListingError(error: { message?: string; code?: string }): string {
  const message = error.message ?? "";
  if (message.includes("account_suspended")) return "Tu cuenta está suspendida.";
  if (message.includes("account_auth_required")) return "Iniciá sesión para continuar.";
  if (message.includes("PERSONAL_LISTING_BLOCKED")) return "Esta publicación fue bloqueada por administración.";
  if (message.includes("PERSONAL_LISTING_CHANGED") || error.code === "40001" || error.code === "40P01") return "La publicación cambió. Volvé a cargarla antes de guardar.";
  if (message.includes("PERSONAL_LISTING_PUBLISH_REQUIREMENTS")) return "Para publicar, agregá de una a cinco fotos, localidad y un contacto autorizado.";
  if (message.includes("PERSONAL_LISTING_CONTACT_REQUIRED")) return "Indicá un WhatsApp argentino válido y autorizá su publicación.";
  if (message.includes("PERSONAL_LISTING_EXPIRY_INVALID")) return "Elegí una fecha de vencimiento futura o quitá el vencimiento.";
  if (message.includes("PERSONAL_LISTING_FINAL_STATE")) return "Esta publicación ya está vendida o retirada.";
  if (message.includes("PERSONAL_LISTING_INVALID_TRANSITION")) return "No se puede realizar esa acción en el estado actual.";
  if (message.includes("PERSONAL_LISTING_REPORT_LIMIT")) return "Alcanzaste el límite de reportes de hoy. Volvé a intentar mañana.";
  if (message.includes("PERSONAL_LISTING_NOT_OWNED") || message.includes("PERSONAL_LISTING_UNAVAILABLE")) return "Esta publicación no está disponible para tu cuenta.";
  if (message.includes("PERSONAL_LISTING_INVALID_INPUT") || message.includes("PERSONAL_LISTING_CATEGORY_INVALID")
    || message.includes("PERSONAL_LISTING_FILTER_INVALID") || message.includes("PERSONAL_LISTING_IMAGES_INVALID")
    || message.includes("PERSONAL_LISTING_REPORT_INVALID")) return "Revisá los datos e intentá nuevamente.";
  return "No pudimos completar la acción. Volvé a intentar.";
}

import { provinceByCode } from "@/lib/argentina-provinces";
import type {
  ServiceStatus, ServiceMode, ServicePricingMode, ServiceReportReason, ServiceReportStatus, ServiceAuditAction,
  ServiceProviderPresentation, PublicServiceProvider, OwnedServiceProvider, ServiceListingPresentation,
  PublicServiceListing, OwnedServiceListing, ServiceImage, PublicServiceArea, ServicePage, PublicServiceCategory, ServiceReport, ServiceAuditLog,
} from "@/types/services";

export const serviceBucket = "service-images";
export const serviceSignedUrlSeconds = 600;
export const servicePageSize = 24;
export const serviceStatuses: readonly ServiceStatus[] = ["DRAFT", "PUBLISHED", "PAUSED", "WITHDRAWN"];
export const serviceModes: readonly ServiceMode[] = ["ONSITE", "AT_PROVIDER", "REMOTE"];
export const servicePricingModes: readonly ServicePricingMode[] = ["FIXED", "FROM", "QUOTE"];
export const serviceReportReasons: readonly ServiceReportReason[] = ["Información incorrecta", "Servicio prohibido o inapropiado", "Posible estafa", "Contenido ofensivo", "Otro"];
const reportStatuses: readonly ServiceReportStatus[] = ["OPEN", "RESOLVED", "DISMISSED"];
const auditActions: readonly ServiceAuditAction[] = ["PROVIDER_BLOCKED", "PROVIDER_UNBLOCKED", "SERVICE_BLOCKED", "SERVICE_UNBLOCKED", "REPORT_RESOLVED", "REPORT_DISMISSED"];
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pathPattern = /^(providers|listings)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|webp)$/;
export function isServiceId(value: unknown): value is string { return typeof value === "string" && uuidPattern.test(value); }
export function isServicePath(value: unknown, kind?: "providers" | "listings", id?: string): value is string {
  return typeof value === "string" && pathPattern.test(value) && (!kind || value.split("/")[0] === kind) && (!id || value.split("/")[1] === id.toLowerCase());
}
export function requireServiceId(value: string): void { if (!isServiceId(value)) throw new Error("Este servicio no está disponible."); }
export function requireServiceRevision(value: number): void { if (!Number.isSafeInteger(value) || value < 1) throw new Error("Volvé a cargar antes de guardar."); }
export function servicePageWindow(page = 0, size = servicePageSize) {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 50 || !Number.isSafeInteger(page * size) || page * size > 2147483647) throw new Error("No pudimos abrir esa página.");
  return { offset: page * size, limit: size };
}
function invalid(): never { throw new Error("No pudimos leer los servicios. Volvé a intentar."); }
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : invalid(); }
function text(value: unknown): string { return typeof value === "string" ? value : invalid(); }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function bool(value: unknown): boolean { return typeof value === "boolean" ? value : invalid(); }
function finite(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : invalid(); }
function integer(value: unknown, min = 0): number { const n = finite(value); return Number.isSafeInteger(n) && n >= min ? n : invalid(); }
function id(value: unknown): string { return isServiceId(value) ? value : invalid(); }
function nullableId(value: unknown): string | null { return value === null ? null : id(value); }
function date(value: unknown): string { const s = text(value); return Number.isFinite(Date.parse(s)) ? s : invalid(); }
function nullableDate(value: unknown): string | null { return value === null ? null : date(value); }
function choice<T extends string>(value: unknown, values: readonly T[]): T { return values.find(option => option === value) ?? invalid(); }
function place(row: Record<string, unknown>) {
  const province = provinceByCode(text(row.province_code));
  const city = text(row.city);
  if (!province || row.province !== province.name || row.country_code !== "AR" || !city.trim() || city.length > 120) return invalid();
  return { city, province: province.name, province_code: province.code, country_code: "AR" as const };
}
function areas(value: unknown): PublicServiceArea[] {
  if (!Array.isArray(value) || value.length > 30) return invalid();
  return value.map(entry => { const row = object(entry); if (row.coverage_type !== "LOCALITY") return invalid(); return { id: id(row.id), ...place(row), coverage_type: "LOCALITY" as const }; });
}
function provider(value: unknown): ServiceProviderPresentation {
  const row = object(value), providerId = id(row.id), avatar = nullableText(row.avatar_path);
  const method = choice(row.contact_method, ["NONE", "WHATSAPP"] as const), phone = nullableText(row.contact_whatsapp);
  if ((avatar !== null && !isServicePath(avatar, "providers", providerId))
    || (method === "NONE" ? phone !== null : !phone || !/^\+54(?:9)?[1-9]\d{9}$/.test(phone))) return invalid();
  // Nunca trasladar claves desconocidas (owner_id/admin/auth) a una proyección pública.
  return { id: providerId, display_name: text(row.display_name), description: text(row.description), avatar_path: avatar,
    active: bool(row.active), ...place(row), contact_method: method, contact_whatsapp: phone, areas: areas(row.areas),
    created_at: date(row.created_at), updated_at: date(row.updated_at) };
}
function block(row: Record<string, unknown>) {
  const blocked = bool(row.admin_blocked), reason = nullableText(row.admin_block_reason);
  if (blocked ? !reason?.trim() : reason !== null) return invalid();
  return { admin_blocked: blocked, admin_block_reason: reason };
}
export function parsePublicServiceProvider(value: unknown): PublicServiceProvider {
  const parsed = provider(value);
  if (!parsed.active || !parsed.areas.length) return invalid();
  return { ...parsed, active: true };
}
export function parseOwnedServiceProvider(value: unknown): OwnedServiceProvider {
  const row = object(value), parsed = provider(value), consent = nullableDate(row.contact_consent_at);
  if (parsed.contact_method === "WHATSAPP" ? consent === null : consent !== null) return invalid();
  return { ...parsed, owner_id: id(row.owner_id), revision: integer(row.revision, 1), contact_consent_at: consent, ...block(row) };
}
function images(value: unknown, listingId: string): ServiceImage[] {
  if (!Array.isArray(value) || value.length > 5) return invalid();
  const paths = new Set<string>();
  return value.map((entry, position) => {
    const row = object(entry), path = row.object_path;
    if (!isServicePath(path, "listings", listingId) || row.position !== position || paths.has(path)) return invalid();
    paths.add(path); return { id: id(row.id), object_path: path, position };
  });
}
function listing<P extends ServiceProviderPresentation>(value: unknown, parseProvider: (value: unknown) => P): ServiceListingPresentation<P> {
  const row = object(value), listingId = id(row.id), pricing = choice(row.pricing_mode, servicePricingModes);
  const price = row.price === null ? null : finite(row.price), parsedProvider = parseProvider(row.provider);
  if (row.currency !== "ARS" || (pricing === "QUOTE" ? price !== null : price === null || price <= 0 || price > 9999999999.99)
    || row.provider_id !== parsedProvider.id) return invalid();
  return { id: listingId, provider_id: parsedProvider.id, category_id: id(row.category_id), category_name: text(row.category_name), category_slug: text(row.category_slug),
    title: text(row.title), description: text(row.description), service_mode: choice(row.service_mode, serviceModes), pricing_mode: pricing, price, currency: "ARS",
    status: choice(row.status, serviceStatuses), accepting_inquiries: bool(row.accepting_inquiries), provider: parsedProvider,
    created_at: date(row.created_at), updated_at: date(row.updated_at), published_at: nullableDate(row.published_at), images: images(row.images, listingId) };
}
export function parsePublicServiceListing(value: unknown): PublicServiceListing {
  const parsed = listing(value, parsePublicServiceProvider);
  if (parsed.status !== "PUBLISHED" || !parsed.published_at || (parsed.accepting_inquiries && parsed.provider.contact_method !== "WHATSAPP")
    || (!parsed.accepting_inquiries && parsed.provider.contact_method !== "NONE")) return invalid();
  return { ...parsed, status: "PUBLISHED", published_at: parsed.published_at };
}
export function parseOwnedServiceListing(value: unknown): OwnedServiceListing {
  const row = object(value); return { ...listing(value, parseOwnedServiceProvider), revision: integer(row.revision, 1), ...block(row) };
}
export function parseServicePage<T>(value: unknown, parse: (entry: unknown) => T): ServicePage<T> {
  const row = object(value), total = integer(row.total), offset = integer(row.offset), limit = integer(row.limit, 1);
  if (limit > 50 || !Array.isArray(row.items) || row.items.length > limit || row.items.length > total) return invalid();
  return { items: row.items.map(parse), total, offset, limit };
}
export function parseServiceCategories(value: unknown): PublicServiceCategory[] {
  if (!Array.isArray(value)) return invalid();
  return value.map(entry => { const row = object(entry); return { id: id(row.id), parent_id: nullableId(row.parent_id), name: text(row.name), slug: text(row.slug), position: integer(row.position) }; });
}
export function parseServiceReport(value: unknown): ServiceReport {
  const r = object(value); return { id: id(r.id), provider_id: id(r.provider_id), listing_id: nullableId(r.listing_id), reporter_user_id: id(r.reporter_user_id),
    reason: choice(r.reason, serviceReportReasons), details: text(r.details), status: choice(r.status, reportStatuses), revision: integer(r.revision, 1),
    created_at: date(r.created_at), resolved_at: nullableDate(r.resolved_at), resolved_by: nullableId(r.resolved_by), resolution_note: text(r.resolution_note) };
}
export function parseServiceAudit(value: unknown): ServiceAuditLog {
  const r = object(value); return { id: id(r.id), admin_user_id: id(r.admin_user_id), provider_id: id(r.provider_id), listing_id: nullableId(r.listing_id),
    report_id: nullableId(r.report_id), action: choice(r.action, auditActions), reason: text(r.reason), note: text(r.note), created_at: date(r.created_at) };
}
export function serviceError(error: unknown): string {
  const r = error !== null && typeof error === "object" ? error as { message?: unknown; code?: unknown } : {};
  const code = typeof r.message === "string" ? r.message : "";
  const messages: Record<string, string> = {
    account_auth_required: "Iniciá sesión para continuar.", account_suspended: "Tu cuenta está suspendida.",
    SERVICE_CHANGED: "La información cambió. Volvé a cargar antes de guardar.", SERVICE_BLOCKED: "Este prestador o servicio está bloqueado.",
    SERVICE_NOT_OWNED: "No podés administrar este servicio.", SERVICE_INVALID_INPUT: "Revisá los datos del servicio.",
    SERVICE_PROVIDER_EXISTS: "Ya tenés un perfil de servicios. Volvé a cargarlo.", SERVICE_PROFILE_REQUIRED: "Completá tu perfil antes de continuar.",
    SERVICE_LOCATION_INVALID: "Elegí localidades y provincias válidas, sin repetirlas.", SERVICE_AREA_LIMIT: "Podés declarar hasta 30 localidades.",
    SERVICE_LISTING_LIMIT: "Alcanzaste el límite de publicaciones de servicios.", SERVICE_CATEGORY_INVALID: "Elegí una categoría de servicio activa.",
    SERVICE_CONTACT_REQUIRED: "Indicá un WhatsApp válido y autorizá su publicación.", SERVICE_FINAL_STATE: "Este servicio fue retirado y no puede editarse.",
    SERVICE_INVALID_TRANSITION: "No se puede realizar ese cambio de estado.", SERVICE_PUBLISH_REQUIREMENTS: "Revisá contacto autorizado, cobertura, categoría y estado del prestador.",
    SERVICE_IMAGES_INVALID: "Revisá las fotos del servicio.", SERVICE_UNAVAILABLE: "Este servicio no está disponible.",
    SERVICE_FILTER_INVALID: "Revisá los filtros de búsqueda.", SERVICE_REPORT_INVALID: "Revisá los datos del reporte.",
    SERVICE_REPORT_LIMIT: "Alcanzaste el límite de reportes por hoy.", SERVICE_MODERATION_INVALID: "Revisá los datos de la acción administrativa.",
  };
  return messages[code] ?? (r.code === "40001" ? messages.SERVICE_CHANGED : "No pudimos completar la operación. Volvé a cargar antes de reintentar.");
}


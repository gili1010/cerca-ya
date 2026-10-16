import { isServiceId, parseServicePage, servicePageWindow } from "@/lib/services/contracts";
import { provinceByCode } from "@/lib/argentina-provinces";
import type { ServiceRequestView, ServiceRadarOpportunity, ServiceRequestOfferView, AdminServiceRequest,
  ServiceRequestOfferRow, ServiceRadarReport, ServiceRadarAudit } from "@/types/service-radar";

export { servicePageWindow as radarPageWindow, parseServicePage as parseRadarPage };
export const requestStatuses = ["OPEN", "CLOSED", "CANCELLED", "EXPIRED"] as const;
export const offerStatuses = ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
export const radarReportReasons = ["Información inapropiada", "Posible estafa", "Contenido ofensivo", "Otro"] as const;
export const serviceRequestPrivacyNotice = "No publiques teléfonos, emails ni domicilios exactos en el título o la descripción. Coordiná la dirección en privado con el profesional que elijas.";
const reportStatuses = ["OPEN", "RESOLVED", "DISMISSED"] as const;
const actions = ["REQUEST_BLOCKED", "REQUEST_UNBLOCKED", "OFFER_BLOCKED", "OFFER_UNBLOCKED", "REPORT_RESOLVED", "REPORT_DISMISSED"] as const;
function invalid(): never { throw new Error("No pudimos leer el Radar de servicios. Volvé a intentar."); }
function object(value: unknown): Record<string, unknown> { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : invalid(); }
function text(value: unknown): string { return typeof value === "string" ? value : invalid(); }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function id(value: unknown): string { return isServiceId(value) ? value : invalid(); }
function nullableId(value: unknown): string | null { return value === null ? null : id(value); }
function bool(value: unknown): boolean { return typeof value === "boolean" ? value : invalid(); }
function date(value: unknown): string { const s = text(value); return Number.isFinite(Date.parse(s)) ? s : invalid(); }
function nullableDate(value: unknown): string | null { return value === null ? null : date(value); }
function revision(value: unknown): number { return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : invalid(); }
function choice<T extends string>(value: unknown, values: readonly T[]): T { return values.find(item => item === value) ?? invalid(); }
function dates(row: Record<string, unknown>) { return { revision: revision(row.revision), created_at: date(row.created_at), updated_at: date(row.updated_at) }; }
function requestBase(row: Record<string, unknown>) {
 const province = provinceByCode(text(row.province_code)), city = text(row.city);
 if (!province || !city.trim() || city.length > 120 || row.country_code !== "AR") return invalid();
 return { id: id(row.id), category_id: id(row.category_id), title: text(row.title), description: text(row.description),
   city, province_code: province.code, country_code: "AR" as const, status: choice(row.status, requestStatuses),
   ...dates(row), expires_at: date(row.expires_at), selected_offer_id: nullableId(row.selected_offer_id) };
}
export function parseServiceRequest(value: unknown): ServiceRequestView {
 const row = object(value); return { ...requestBase(row), category_name: text(row.category_name), available: bool(row.available) };
}
export function parseServiceOpportunity(value: unknown): ServiceRadarOpportunity {
 const row = object(value); return { ...parseServiceRequest(row), my_offer_id: nullableId(row.my_offer_id) };
}
function offerBase(row: Record<string, unknown>) {
 const mode = choice(row.pricing_mode, ["FIXED", "FROM", "QUOTE"] as const), price = row.proposed_price;
 if (row.currency !== "ARS" || (mode === "QUOTE" ? price !== null : typeof price !== "number" || !Number.isFinite(price) || price <= 0 || price > 9999999999.99)) return invalid();
 return { id: id(row.id), request_id: id(row.request_id), provider_id: id(row.provider_id), service_listing_id: id(row.service_listing_id),
   message: text(row.message), pricing_mode: mode, proposed_price: price === null ? null : typeof price === "number" ? price : invalid(),
   currency: "ARS" as const, status: choice(row.status, offerStatuses), ...dates(row) };
}
export function parseServiceRequestOffer(value: unknown): ServiceRequestOfferView {
 const row = object(value), base = offerBase(row), request = parseServiceRequest(row.request), contact = nullableText(row.contact_whatsapp);
 if (request.id !== base.request_id || (contact !== null && (base.status !== "ACCEPTED" || !/^\+54(?:9)?[1-9]\d{9}$/.test(contact)))) return invalid();
 return { ...base, provider_name: text(row.provider_name), provider_available: bool(row.provider_available), available: bool(row.available), contact_whatsapp: contact, request };
}
function block(row: Record<string, unknown>) {
 return { admin_blocked_at: nullableDate(row.admin_blocked_at), admin_blocked_by: nullableId(row.admin_blocked_by), admin_block_reason: nullableText(row.admin_block_reason) };
}
export function parseAdminServiceRequest(value: unknown): AdminServiceRequest {
 const row = object(value); return { ...requestBase(row), ...block(row), requester_id: id(row.requester_id), city_normalized: text(row.city_normalized), effective_status: choice(row.effective_status, requestStatuses) };
}
export function parseAdminServiceRequestOffer(value: unknown): ServiceRequestOfferRow {
 const row = object(value); return { ...offerBase(row), ...block(row) };
}
export function parseServiceRadarReport(value: unknown): ServiceRadarReport {
 const row = object(value); return { id: id(row.id), request_id: id(row.request_id), offer_id: nullableId(row.offer_id), reporter_user_id: id(row.reporter_user_id),
   reason: choice(row.reason, radarReportReasons), details: text(row.details), status: choice(row.status, reportStatuses), revision: revision(row.revision),
   created_at: date(row.created_at), resolved_at: nullableDate(row.resolved_at), resolved_by: nullableId(row.resolved_by), resolution_note: text(row.resolution_note) };
}
export function parseServiceRadarAudit(value: unknown): ServiceRadarAudit {
 const row = object(value); return { id: id(row.id), request_id: id(row.request_id), offer_id: nullableId(row.offer_id), report_id: nullableId(row.report_id),
   admin_user_id: id(row.admin_user_id), action: choice(row.action, actions), reason: text(row.reason), note: text(row.note), created_at: date(row.created_at) };
}
export function serviceRadarError(value: unknown): string {
 const error = value !== null && typeof value === "object" ? value as { code?: unknown; message?: unknown } : {};
 const message = typeof error.message === "string" ? error.message : "";
 if (error.code === "40001" || message.includes("SERVICE_RADAR_CHANGED")) return "La información cambió. Volvé a cargar antes de continuar.";
 if (message.includes("SERVICE_RADAR_DUPLICATE_REQUEST")) return "Ya tenés una solicitud igual abierta. Revisá tus solicitudes.";
 if (message.includes("SERVICE_RADAR_DUPLICATE_OFFER") || error.code === "23505") return "Ya existe una propuesta. Volvé a cargar antes de continuar.";
 if (message.includes("SERVICE_RADAR_HAS_OFFERS")) return "La solicitud ya recibió propuestas y no puede editarse. Podés cerrarla o cancelarla.";
 if (message.includes("SERVICE_RADAR_PROVIDER_UNAVAILABLE")) return "Completá tu perfil, contacto autorizado y cobertura para recibir oportunidades.";
 if (message.includes("SERVICE_RADAR_NOT_ELIGIBLE")) return "Tu perfil o servicio ya no cumple los requisitos de especialidad y cobertura para este trabajo.";
 if (message.includes("SERVICE_RADAR_UNAVAILABLE")) return "Esta solicitud o propuesta ya no está disponible. Actualizá el estado para continuar.";
 if (message.includes("SERVICE_RADAR_CATEGORY_INVALID")) return "Elegí una especialidad disponible, no un grupo de categorías.";
 if (message.includes("SERVICE_RADAR_FILTER_INVALID")) return "Revisá la especialidad o la página seleccionada.";
 if (message.includes("SERVICE_RADAR_LIMIT")) return "Alcanzaste el límite de actividad. Esperá antes de volver a intentar.";
 if (message.includes("account_suspended")) return "Tu cuenta no está habilitada para realizar esta acción.";
 if (message.includes("account_auth_required")) return "Iniciá sesión para continuar.";
 if (error.code === "42501") return "No tenés permiso o ya no cumplís los requisitos para esta acción.";
 return "No pudimos completar la operación. Volvé a cargar y revisá el estado antes de reintentar.";
}

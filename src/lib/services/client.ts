import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type { ServiceProviderInput, ServiceListingInput, ServiceAreaInput, ServiceSearchOptions, MyServiceOptions, ServiceAction, ServiceEntity, ServiceReportReason } from "@/types/services";
import { normalizeArgentinaPhone } from "@/lib/phone";
import { provinceByCode } from "@/lib/argentina-provinces";
import {
  parseServiceCategories, parsePublicServiceProvider, parsePublicServiceListing, parseOwnedServiceProvider, parseOwnedServiceListing, parseServicePage,
  requireServiceId, requireServiceRevision, isServicePath, servicePageWindow, serviceError,
} from "./contracts";

type Client = SupabaseClient<Database>;
async function mutation(request: PromiseLike<{ data: unknown; error: unknown }>, expectedId: string): Promise<string> {
  const { data, error } = await request;
  if (error) throw new Error(serviceError(error));
  if (typeof data !== "string" || data.toLowerCase() !== expectedId.toLowerCase()) throw new Error("No pudimos confirmar el cambio. Volvé a cargar antes de reintentar.");
  requireServiceId(data); return data;
}
function searchArgs(options: ServiceSearchOptions) {
  if (!options.locality.trim() || options.locality.length > 120 || !provinceByCode(options.provinceCode) || (options.query?.length ?? 0) > 160) throw new Error("Elegí una localidad y provincia válidas.");
  if (options.categoryId) requireServiceId(options.categoryId);
  return { p_locality: options.locality.trim(), p_province_code: options.provinceCode, p_query: options.query ?? "", p_category_id: options.categoryId ?? null,
    p_offset: servicePageWindow(options.page, options.pageSize).offset, p_limit: servicePageWindow(options.page, options.pageSize).limit };
}
export async function readServiceCategories(client: Client, signal?: AbortSignal) {
  let request = client.rpc("read_service_categories", {}); if (signal) request = request.abortSignal(signal);
  const { data, error } = await request; if (error) throw new Error(serviceError(error));
  return parseServiceCategories(data);
}
export async function readServiceListings(client: Client, options: ServiceSearchOptions, signal?: AbortSignal) {
  if (options.providerId) requireServiceId(options.providerId);
  let request = client.rpc("read_service_listings_page", { ...searchArgs(options), p_provider_id: options.providerId ?? null });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request; if (error) throw new Error(serviceError(error));
  return parseServicePage(data, parsePublicServiceListing);
}
export async function readServiceProviders(client: Client, options: Omit<ServiceSearchOptions, "providerId">, signal?: AbortSignal) {
  let request = client.rpc("read_service_providers_page", searchArgs(options)); if (signal) request = request.abortSignal(signal);
  const { data, error } = await request; if (error) throw new Error(serviceError(error));
  return parseServicePage(data, parsePublicServiceProvider);
}
export async function readPublicServiceProvider(client: Client, id: string) {
  requireServiceId(id); const { data, error } = await client.rpc("read_public_service_provider", { p_provider_id: id });
  if (error) throw new Error(serviceError(error)); return data === null ? null : parsePublicServiceProvider(data);
}
export async function readPublicServiceListing(client: Client, id: string) {
  requireServiceId(id); const { data, error } = await client.rpc("read_public_service_listing", { p_listing_id: id });
  if (error) throw new Error(serviceError(error)); return data === null ? null : parsePublicServiceListing(data);
}
export async function readMyServiceProvider(client: Client) {
  const { data, error } = await client.rpc("read_my_service_provider", {});
  if (error) throw new Error(serviceError(error)); return data === null ? null : parseOwnedServiceProvider(data);
}
export async function readMyServiceListings(client: Client, options: MyServiceOptions = {}, signal?: AbortSignal) {
  if (options.listingId) requireServiceId(options.listingId);
  const window = servicePageWindow(options.page, options.pageSize);
  let request = client.rpc("read_my_service_listings", { p_listing_id: options.listingId ?? null, p_status: options.status ?? null, p_offset: window.offset, p_limit: window.limit });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request; if (error) throw new Error(serviceError(error)); return parseServicePage(data, parseOwnedServiceListing);
}
export async function readMyServiceListing(client: Client, id: string) { return (await readMyServiceListings(client, { listingId: id, pageSize: 1 })).items[0] ?? null; }
function providerPayload(input: ServiceProviderInput): Json {
  const phone = input.contact_method === "WHATSAPP" ? normalizeArgentinaPhone(input.contact_whatsapp) : null;
  if (!provinceByCode(input.province_code) || !input.city.trim()) throw new Error("Elegí una localidad y provincia válidas.");
  if (input.contact_method === "WHATSAPP" && (!phone || !input.contact_consent)) throw new Error("Indicá un WhatsApp válido y autorizá su publicación.");
  if (input.contact_method === "NONE" && (input.contact_consent || input.contact_whatsapp?.trim())) throw new Error("Revisá el método de contacto y su autorización.");
  return { display_name: input.display_name, description: input.description, city: input.city, province_code: input.province_code, active: input.active,
    contact_method: input.contact_method, contact_whatsapp: phone ? `+${phone}` : null, contact_consent: input.contact_consent };
}
/** UUID suministrado por el caller: conservarlo y reconciliar antes de reintentar una respuesta incierta. */
export function createServiceProvider(client: Client, id: string, input: ServiceProviderInput) {
  requireServiceId(id); return mutation(client.rpc("save_my_service_provider", { p_provider_id: id, p_input: providerPayload(input), p_expected_revision: null }), id);
}
export function updateServiceProvider(client: Client, id: string, revision: number, input: ServiceProviderInput) {
  requireServiceId(id); requireServiceRevision(revision);
  return mutation(client.rpc("save_my_service_provider", { p_provider_id: id, p_input: providerPayload(input), p_expected_revision: revision }), id);
}
export function setServiceAreas(client: Client, id: string, revision: number, areas: ServiceAreaInput[]) {
  requireServiceId(id); requireServiceRevision(revision);
  if (areas.length > 30 || areas.some(area => !area.city.trim() || !provinceByCode(area.province_code))) throw new Error("Revisá las localidades de cobertura.");
  const payload: Json = areas.map(area => ({ city: area.city, province_code: area.province_code }));
  return mutation(client.rpc("set_my_service_areas", { p_provider_id: id, p_areas: payload, p_expected_revision: revision }), id);
}
function listingPayload(input: ServiceListingInput): Json {
  requireServiceId(input.category_id);
  if (input.pricing_mode === "QUOTE" ? input.price !== null : input.price === null || !Number.isFinite(input.price) || input.price <= 0) throw new Error("Revisá la modalidad y el precio del servicio.");
  return { category_id: input.category_id, title: input.title, description: input.description, service_mode: input.service_mode,
    pricing_mode: input.pricing_mode, price: input.price, accepting_inquiries: input.accepting_inquiries };
}
export function createServiceListing(client: Client, providerId: string, id: string, input: ServiceListingInput) {
  requireServiceId(providerId); requireServiceId(id);
  return mutation(client.rpc("save_my_service_listing", { p_provider_id: providerId, p_listing_id: id, p_input: listingPayload(input), p_expected_revision: null }), id);
}
export function updateServiceListing(client: Client, providerId: string, id: string, revision: number, input: ServiceListingInput) {
  requireServiceId(providerId); requireServiceId(id); requireServiceRevision(revision);
  return mutation(client.rpc("save_my_service_listing", { p_provider_id: providerId, p_listing_id: id, p_input: listingPayload(input), p_expected_revision: revision }), id);
}
export function manageServiceListing(client: Client, id: string, revision: number, action: ServiceAction) {
  requireServiceId(id); requireServiceRevision(revision);
  return mutation(client.rpc("manage_my_service_listing", { p_listing_id: id, p_action: action, p_expected_revision: revision }), id);
}
export function setServiceListingImages(client: Client, id: string, revision: number, paths: string[]) {
  requireServiceId(id); requireServiceRevision(revision);
  if (paths.length > 5 || new Set(paths).size !== paths.length || paths.some(path => !isServicePath(path, "listings", id))) throw new Error("Revisá las fotos del servicio.");
  return mutation(client.rpc("set_my_service_listing_images", { p_listing_id: id, p_paths: paths, p_expected_revision: revision }), id);
}
export function setServiceProviderAvatar(client: Client, id: string, revision: number, path: string | null) {
  requireServiceId(id); requireServiceRevision(revision);
  if (path !== null && !isServicePath(path, "providers", id)) throw new Error("Revisá la foto del prestador.");
  return mutation(client.rpc("set_my_service_provider_avatar", { p_provider_id: id, p_path: path, p_expected_revision: revision }), id);
}
export async function reportService(client: Client, entity: ServiceEntity, id: string, reason: ServiceReportReason, details = "") {
  requireServiceId(id); const { data, error } = await client.rpc("report_service", { p_entity: entity, p_id: id, p_reason: reason, p_details: details });
  if (error) throw new Error(serviceError(error)); if (typeof data !== "string") throw new Error("No pudimos confirmar el reporte.");
  requireServiceId(data); return data;
}


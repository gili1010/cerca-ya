import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ServiceRequestInput, ServiceRequestOfferInput, ServiceRadarOptions, ServiceRadarOfferOptions, ServiceRadarEntity, ServiceRadarReportReason } from "@/types/service-radar";
import { requireServiceId, requireServiceRevision } from "@/lib/services/contracts";
import { parseServiceRequest, parseServiceOpportunity, parseServiceRequestOffer, parseRadarPage, radarPageWindow, serviceRadarError } from "./contracts";

type Client = SupabaseClient<Database>;
export class ServiceRadarMutationError extends Error {
 constructor(message: string, public readonly recordId: string, public readonly uncertain: boolean) { super(message); this.name = "ServiceRadarMutationError"; }
}
async function mutation(request: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>, expectedId: string) {
 let response: { data: unknown; error: { code?: string; message?: string } | null };
 try { response = await request; } catch { throw new ServiceRadarMutationError(serviceRadarError(null), expectedId, true); }
 if (response.error) throw new ServiceRadarMutationError(serviceRadarError(response.error), expectedId, !response.error.code || ["08007", "40003"].includes(response.error.code));
 if (typeof response.data !== "string" || response.data.toLowerCase() !== expectedId.toLowerCase()) throw new ServiceRadarMutationError(serviceRadarError(null), expectedId, true);
 return response.data;
}
export async function readMyServiceRequests(client: Client, options: Omit<ServiceRadarOptions, "categoryId"> = {}, signal?: AbortSignal) {
 if (options.requestId) requireServiceId(options.requestId);
 const page = radarPageWindow(options.page, options.pageSize);
 let request = client.rpc("read_my_service_requests", { p_request_id: options.requestId ?? null, p_offset: page.offset, p_limit: page.limit });
 if (signal) request = request.abortSignal(signal);
 const { data, error } = await request; if (error) throw new Error(serviceRadarError(error)); return parseRadarPage(data, parseServiceRequest);
}
export async function readServiceRadar(client: Client, options: ServiceRadarOptions = {}, signal?: AbortSignal) {
 if (options.requestId) requireServiceId(options.requestId); if (options.categoryId) requireServiceId(options.categoryId);
 const page = radarPageWindow(options.page, options.pageSize);
 let request = client.rpc("read_service_radar", { p_request_id: options.requestId ?? null, p_category_id: options.categoryId ?? null, p_offset: page.offset, p_limit: page.limit });
 if (signal) request = request.abortSignal(signal);
 const { data, error } = await request; if (error) throw new Error(serviceRadarError(error)); return parseRadarPage(data, parseServiceOpportunity);
}
export async function readServiceRequestOffers(client: Client, options: ServiceRadarOfferOptions = {}, signal?: AbortSignal) {
 if (options.requestId) requireServiceId(options.requestId); if (options.offerId) requireServiceId(options.offerId);
 const page = radarPageWindow(options.page, options.pageSize);
 let request = client.rpc("read_service_request_offers", { p_seller: options.seller ?? false, p_request_id: options.requestId ?? null, p_offer_id: options.offerId ?? null, p_offset: page.offset, p_limit: page.limit });
 if (signal) request = request.abortSignal(signal);
 const { data, error } = await request; if (error) throw new Error(serviceRadarError(error)); return parseRadarPage(data, parseServiceRequestOffer);
}
export function saveMyServiceRequest(client: Client, id: string, input: ServiceRequestInput, revision: number | null = null) {
 requireServiceId(id); requireServiceId(input.category_id); if (revision !== null) requireServiceRevision(revision);
 return mutation(client.rpc("save_my_service_request", { p_request_id: id, p_input: { title: input.title, description: input.description, category_id: input.category_id, city: input.city, province_code: input.province_code }, p_expected_revision: revision }), id);
}
export function saveMyServiceRequestOffer(client: Client, id: string, requestId: string, listingId: string, input: ServiceRequestOfferInput, revision: number | null = null) {
 requireServiceId(id); requireServiceId(requestId); requireServiceId(listingId); if (revision !== null) requireServiceRevision(revision);
 return mutation(client.rpc("save_my_service_request_offer", { p_offer_id: id, p_request_id: requestId, p_service_listing_id: listingId, p_input: { message: input.message, pricing_mode: input.pricing_mode, proposed_price: input.proposed_price }, p_expected_revision: revision }), id);
}
export function manageMyServiceRequest(client: Client, id: string, revision: number, action: "cancel" | "close" | "expire") {
 requireServiceId(id); requireServiceRevision(revision);
 return mutation(client.rpc("manage_my_service_request", { p_request_id: id, p_expected_revision: revision, p_action: action }), id);
}
export function manageMyServiceRequestOffer(client: Client, id: string, revision: number, action: "accept" | "reject" | "withdraw", requestRevision: number | null = null) {
 requireServiceId(id); requireServiceRevision(revision); if (requestRevision !== null) requireServiceRevision(requestRevision);
 return mutation(client.rpc("manage_my_service_request_offer", { p_offer_id: id, p_expected_revision: revision, p_action: action, p_request_expected_revision: requestRevision }), id);
}
export async function reportServiceRadar(client: Client, entity: ServiceRadarEntity, id: string, reason: ServiceRadarReportReason, details = "") {
 requireServiceId(id);
 const { data, error } = await client.rpc("report_service_radar", { p_entity: entity, p_id: id, p_reason: reason, p_details: details });
 if (error) throw new Error(serviceRadarError(error)); if (typeof data !== "string") throw new Error(serviceRadarError(null)); requireServiceId(data); return data;
}

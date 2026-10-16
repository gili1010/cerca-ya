import type { ServiceRequestInput, ServiceRequestView, ServiceRequestOfferView } from "@/types/service-radar";
import { isServiceId } from "@/lib/services/contracts";
import { normalizePlace } from "@/lib/argentina-provinces";

export interface RequestDraft { id: string; input: ServiceRequestInput; baseRevision: number | null; step: number; uncertain: boolean }
export interface OfferDraft { id: string; requestId: string; listingId: string; message: string; mode: "FIXED" | "FROM" | "QUOTE"; price: string; baseRevision: number | null; uncertain: boolean }
function record(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function validRevision(value: unknown) { return value === null || (typeof value === "number" && Number.isSafeInteger(value) && value > 0); }
export function parseRequestDraft(value: unknown): RequestDraft | null {
 const row = record(value), input = record(row?.input);
 if (!row || !input || !isServiceId(row.id) || !validRevision(row.baseRevision) || typeof row.uncertain !== "boolean" || typeof row.step !== "number" || ![1,2,3].includes(row.step)
   || ["title","description","category_id","city","province_code"].some(key => typeof input[key] !== "string")
   || String(input.title).length > 120 || String(input.description).length > 2000 || String(input.city).length > 120) return null;
 return { id: row.id, baseRevision: row.baseRevision as number | null, uncertain: row.uncertain, step: row.step,
   input: { title: String(input.title), description: String(input.description), category_id: String(input.category_id), city: String(input.city), province_code: String(input.province_code) } };
}
export function parseOfferDraft(value: unknown): OfferDraft | null {
 const row = record(value);
 if (!row || !isServiceId(row.id) || !isServiceId(row.requestId) || typeof row.listingId !== "string" || !validRevision(row.baseRevision) || typeof row.uncertain !== "boolean"
   || typeof row.message !== "string" || row.message.length > 1500 || typeof row.price !== "string" || row.price.length > 32
   || (row.listingId !== "" && !isServiceId(row.listingId)) || (row.mode !== "QUOTE" && row.mode !== "FIXED" && row.mode !== "FROM")) return null;
 return { id: row.id, requestId: row.requestId, listingId: row.listingId, message: row.message, mode: row.mode, price: row.price, baseRevision: row.baseRevision as number | null, uncertain: row.uncertain };
}
export function requestMatches(row: ServiceRequestView, input: ServiceRequestInput) {
 return row.title === input.title.trim() && row.description === input.description.trim() && row.category_id.toLowerCase() === input.category_id.toLowerCase()
   && normalizePlace(row.city) === normalizePlace(input.city) && row.province_code === input.province_code;
}
export function offerMatches(row: ServiceRequestOfferView, draft: OfferDraft, price: number | null) {
 return row.id === draft.id && row.request_id === draft.requestId && row.service_listing_id === draft.listingId && row.message === draft.message.trim()
   && row.pricing_mode === draft.mode && row.proposed_price === price && (draft.baseRevision === null || row.revision > draft.baseRevision);
}

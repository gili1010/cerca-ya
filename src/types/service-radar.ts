import type { ServicePricingMode, ServicePagination } from "./services";

export type ServiceRequestStatus = "OPEN" | "CLOSED" | "CANCELLED" | "EXPIRED";
export type ServiceRequestOfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
export type ServiceRadarEntity = "request" | "offer";
export type ServiceRadarReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type ServiceRadarReportReason = "Información inapropiada" | "Posible estafa" | "Contenido ofensivo" | "Otro";
export interface ServiceRequestInput { title: string; description: string; category_id: string; city: string; province_code: string }
export interface ServiceRequestOfferInput { message: string; pricing_mode: ServicePricingMode; proposed_price: number | null }
export interface ServiceRequestView extends ServiceRequestInput {
 id: string; category_name: string; country_code: "AR"; status: ServiceRequestStatus;
 revision: number; created_at: string; updated_at: string; expires_at: string;
 selected_offer_id: string | null; available: boolean;
}
export interface ServiceRadarOpportunity extends ServiceRequestView { my_offer_id: string | null }
export interface ServiceRequestOfferView extends ServiceRequestOfferInput {
 id: string; request_id: string; provider_id: string; service_listing_id: string; currency: "ARS";
 status: ServiceRequestOfferStatus; revision: number; created_at: string; updated_at: string;
 provider_name: string; provider_available: boolean; available: boolean; contact_whatsapp: string | null;
 request: ServiceRequestView;
}
interface RadarBlock { admin_blocked_at: string | null; admin_blocked_by: string | null; admin_block_reason: string | null }
export interface ServiceRequestRow extends Omit<ServiceRequestView, "category_name" | "available">, RadarBlock { requester_id: string; city_normalized: string }
export interface ServiceRequestOfferRow extends Omit<ServiceRequestOfferView, "provider_name" | "provider_available" | "available" | "contact_whatsapp" | "request">, RadarBlock {}
export interface AdminServiceRequest extends ServiceRequestRow { effective_status: ServiceRequestStatus }
export interface ServiceRadarReport {
 id: string; request_id: string; offer_id: string | null; reporter_user_id: string; reason: ServiceRadarReportReason;
 details: string; status: ServiceRadarReportStatus; revision: number; created_at: string;
 resolved_at: string | null; resolved_by: string | null; resolution_note: string;
}
export interface ServiceRadarAudit {
 id: string; admin_user_id: string; request_id: string; offer_id: string | null; report_id: string | null;
 action: "REQUEST_BLOCKED" | "REQUEST_UNBLOCKED" | "OFFER_BLOCKED" | "OFFER_UNBLOCKED" | "REPORT_RESOLVED" | "REPORT_DISMISSED";
 reason: string; note: string; created_at: string;
}
export interface ServiceRadarOptions extends ServicePagination { requestId?: string | null; categoryId?: string | null }
export interface ServiceRadarOfferOptions extends ServicePagination { seller?: boolean; requestId?: string | null; offerId?: string | null }

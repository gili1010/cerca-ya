/** Servicios independientes de products, businesses, stock y reservas. */
export type ServiceStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "WITHDRAWN";
export type ServiceMode = "ONSITE" | "AT_PROVIDER" | "REMOTE";
export type ServicePricingMode = "FIXED" | "FROM" | "QUOTE";
export type ServiceAction = "publish" | "pause" | "withdraw";
export type ServiceEntity = "provider" | "listing";
export type ServiceReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type ServiceReportReason = "Información incorrecta" | "Servicio prohibido o inapropiado" | "Posible estafa" | "Contenido ofensivo" | "Otro";
export type ServiceAuditAction = "PROVIDER_BLOCKED" | "PROVIDER_UNBLOCKED" | "SERVICE_BLOCKED" | "SERVICE_UNBLOCKED" | "REPORT_RESOLVED" | "REPORT_DISMISSED";

interface ServiceDates { created_at: string; updated_at: string }
interface ServiceBlock { admin_blocked_at: string | null; admin_blocked_by: string | null; admin_block_reason: string | null }
export interface ServiceProviderRow extends ServiceDates, ServiceBlock {
  id: string; owner_id: string; display_name: string; description: string;
  avatar_path: string | null; active: boolean; revision: number; search_document: string;
}
export interface ServiceCategoryRow {
  id: string; parent_id: string | null; name: string; slug: string; active: boolean; position: number;
}
export type PublicServiceCategory = Omit<ServiceCategoryRow, "active">;
export interface ServiceListingRow extends ServiceDates, ServiceBlock {
  id: string; provider_id: string; category_id: string; title: string; description: string;
  service_mode: ServiceMode; pricing_mode: ServicePricingMode; price: number | null; currency: "ARS";
  status: ServiceStatus; accepting_inquiries: boolean; published_at: string | null;
  revision: number; search_document: string;
}
export interface ServiceListingImageRow {
  id: string; listing_id: string; object_path: string; position: number; created_at: string;
}
export type ServiceImage = Pick<ServiceListingImageRow, "id" | "object_path" | "position">;
export interface ServiceAreaRow {
  id: string; provider_id: string; city: string; city_normalized: string;
  province_code: string; province: string; country_code: "AR"; coverage_type: "LOCALITY";
}
export type PublicServiceArea = Omit<ServiceAreaRow, "provider_id" | "city_normalized">;
export interface ServiceProviderPresentation extends ServiceDates {
  id: string; display_name: string; description: string; avatar_path: string | null; active: boolean;
  city: string; province: string; province_code: string; country_code: "AR";
  contact_method: "NONE" | "WHATSAPP"; contact_whatsapp: string | null; areas: PublicServiceArea[];
}
export interface PublicServiceProvider extends ServiceProviderPresentation { active: true }
export interface OwnedServiceProvider extends ServiceProviderPresentation {
  owner_id: string; revision: number; contact_consent_at: string | null; admin_blocked: boolean; admin_block_reason: string | null;
}
export interface ServiceListingPresentation<P extends ServiceProviderPresentation = ServiceProviderPresentation> extends ServiceDates {
  id: string; provider_id: string; category_id: string; category_name: string; category_slug: string;
  title: string; description: string; service_mode: ServiceMode; pricing_mode: ServicePricingMode;
  price: number | null; currency: "ARS"; status: ServiceStatus; accepting_inquiries: boolean;
  published_at: string | null; provider: P; images: ServiceImage[];
}
export interface PublicServiceListing extends ServiceListingPresentation<PublicServiceProvider> { status: "PUBLISHED"; published_at: string }
export interface OwnedServiceListing extends ServiceListingPresentation<OwnedServiceProvider> {
  revision: number; admin_blocked: boolean; admin_block_reason: string | null;
}
export interface ServicePage<T> { items: T[]; total: number; offset: number; limit: number }
export interface ServicePagination { page?: number; pageSize?: number }
export interface ServiceSearchOptions extends ServicePagination {
  locality: string; provinceCode: string; query?: string; categoryId?: string | null; providerId?: string | null;
}
export interface MyServiceOptions extends ServicePagination { listingId?: string | null; status?: ServiceStatus | null }
export interface ServiceProviderInput {
  display_name: string; description: string; city: string; province_code: string; active: boolean;
  contact_method: "NONE" | "WHATSAPP"; contact_whatsapp: string | null; contact_consent: boolean;
}
export interface ServiceListingInput {
  title: string; description: string; category_id: string; service_mode: ServiceMode;
  pricing_mode: ServicePricingMode; price: number | null; accepting_inquiries: boolean;
}
export interface ServiceAreaInput { city: string; province_code: string }
export interface ServiceReport {
  id: string; provider_id: string; listing_id: string | null; reporter_user_id: string;
  reason: ServiceReportReason; details: string; status: ServiceReportStatus; revision: number;
  created_at: string; resolved_at: string | null; resolved_by: string | null; resolution_note: string;
}
export interface ServiceAuditLog {
  id: string; admin_user_id: string; provider_id: string; listing_id: string | null; report_id: string | null;
  action: ServiceAuditAction; reason: string; note: string; created_at: string;
}

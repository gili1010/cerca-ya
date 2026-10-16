/** Contrato del nuevo módulo. No representa productos ni reservas comerciales. */
export type PersonalListingStatus = "DRAFT" | "PUBLISHED" | "PAUSED" | "SOLD" | "WITHDRAWN";
export type PersonalItemCondition = "NEW" | "USED";
export type PersonalContactMethod = "NONE" | "WHATSAPP";
export type PersonalListingAction = "publish" | "pause" | "sold" | "withdraw";
export type PersonalListingSort = "newest" | "price_asc" | "price_desc";
export type PersonalListingReportReason = "Información incorrecta" | "Artículo prohibido o inapropiado" | "Posible estafa" | "Contenido ofensivo" | "Otro";
export type PersonalListingReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";

/** Fila interna. No pasar a un componente público; utilizar PublicPersonalListing. */
export interface PersonalListingRow {
  id: string; owner_id: string; category_id: string; title: string; description: string;
  price: number; currency: "ARS"; negotiable: boolean; item_condition: PersonalItemCondition;
  status: PersonalListingStatus; seller_display_name: string; contact_method: PersonalContactMethod;
  contact_whatsapp: string | null; contact_consent_at: string | null;
  admin_blocked_at: string | null; admin_blocked_by: string | null; admin_block_reason: string | null;
  created_at: string; updated_at: string; published_at: string | null; expires_at: string | null;
  revision: number; search_document: string;
}

export interface PersonalListingImageRow {
  id: string; listing_id: string; object_path: string; position: number; created_at: string;
}
export type PersonalListingImage = Pick<PersonalListingImageRow, "id" | "object_path" | "position">;

export interface PersonalListingPresentation {
  id: string; category_id: string; category_name: string; category_slug: string;
  title: string; description: string; price: number; currency: "ARS"; negotiable: boolean;
  item_condition: PersonalItemCondition; seller_display_name: string; contact_method: PersonalContactMethod;
  contact_whatsapp: string | null; city: string; province: string; province_code: string; country_code: "AR";
  created_at: string; updated_at: string; published_at: string | null; expires_at: string | null;
  images: PersonalListingImage[];
}

/** Sin owner_id, email, GPS, domicilio ni campos administrativos. */
export interface PublicPersonalListing extends PersonalListingPresentation {
  status: "PUBLISHED"; contact_method: "WHATSAPP"; contact_whatsapp: string; published_at: string;
}
export interface OwnedPersonalListing extends PersonalListingPresentation {
  status: PersonalListingStatus; owner_id: string; revision: number; contact_consent_at: string | null;
  admin_blocked: boolean; admin_block_reason: string | null; expired: boolean;
}

export interface PersonalListingInput {
  category_id: string; title: string; description: string; price: number; negotiable: boolean;
  item_condition: PersonalItemCondition; city: string; province_code: string;
  seller_display_name: string; expires_at: string | null;
  contact_method: PersonalContactMethod; contact_whatsapp: string | null; contact_consent: boolean;
}

export interface PersonalListingPage<T> { items: T[]; total: number; offset: number; limit: number }
export interface PersonalListingPageOptions {
  locality: string; provinceCode: string; query?: string; categoryId?: string | null;
  condition?: PersonalItemCondition | null; from?: string | null; until?: string | null;
  sort?: PersonalListingSort; page?: number; pageSize?: number;
}
export interface OwnedPersonalListingPageOptions {
  listingId?: string | null; status?: PersonalListingStatus | null; query?: string;
  categoryId?: string | null; locality?: string | null; provinceCode?: string | null;
  from?: string | null; until?: string | null; page?: number; pageSize?: number;
}

export interface PersonalListingReport {
  id: string; listing_id: string; reporter_user_id: string; reason: PersonalListingReportReason;
  details: string; status: PersonalListingReportStatus; created_at: string; resolved_at: string | null;
  resolved_by: string | null; resolution_note: string;
}
export interface PersonalListingAuditLog {
  id: string; admin_user_id: string; listing_id: string; report_id: string | null;
  action: "LISTING_BLOCKED" | "LISTING_UNBLOCKED" | "REPORT_RESOLVED" | "REPORT_DISMISSED";
  reason: string; note: string; created_at: string;
}

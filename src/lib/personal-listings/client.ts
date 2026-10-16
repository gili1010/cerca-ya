import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import type {
  OwnedPersonalListingPageOptions, PersonalListingAction, PersonalListingInput,
  PersonalListingPageOptions, PersonalListingReportReason,
} from "@/types/personal-listings";
import { normalizeArgentinaPhone } from "@/lib/phone";
import { provinceByCode } from "@/lib/argentina-provinces";
import {
  pageWindow, parseListingPage, parseOwnedPersonalListing, parsePublicPersonalListing,
  personalListingError, requireListingId, requireRevision,
} from "./contracts";

type Client = SupabaseClient<Database>;

function inputPayload(input: PersonalListingInput): Json {
  const phone = input.contact_method === "WHATSAPP" ? normalizeArgentinaPhone(input.contact_whatsapp) : null;
  if (input.contact_method === "WHATSAPP" && (!phone || !input.contact_consent)) {
    throw new Error("Indicá un WhatsApp argentino válido y autorizá su publicación.");
  }
  if (!provinceByCode(input.province_code)) throw new Error("Elegí una provincia válida.");
  // No usar perfil/Auth como origen de estos campos. La autorización es explícita.
  return {
    category_id: input.category_id, title: input.title, description: input.description, price: input.price,
    negotiable: input.negotiable, item_condition: input.item_condition, city: input.city,
    province_code: input.province_code, seller_display_name: input.seller_display_name, expires_at: input.expires_at,
    contact_method: input.contact_method, contact_whatsapp: phone ? `+${phone}` : null,
    contact_consent: input.contact_method === "WHATSAPP" && input.contact_consent,
  };
}

export async function readPersonalListings(client: Client, options: PersonalListingPageOptions, signal?: AbortSignal) {
  const window = pageWindow(options.page, options.pageSize);
  let request = client.rpc("read_personal_listings_page", {
    p_locality: options.locality, p_province_code: options.provinceCode, p_query: options.query ?? "",
    p_category_id: options.categoryId ?? null, p_condition: options.condition ?? null,
    p_status: "PUBLISHED", p_from: options.from ?? null, p_until: options.until ?? null,
    p_sort: options.sort ?? "newest", p_offset: window.offset, p_limit: window.limit,
  });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(personalListingError(error));
  return parseListingPage(data, parsePublicPersonalListing);
}

export async function readPublicPersonalListing(client: Client, id: string) {
  requireListingId(id);
  const { data, error } = await client.rpc("read_public_personal_listing", { p_listing_id: id });
  if (error) throw new Error(personalListingError(error));
  return data === null ? null : parsePublicPersonalListing(data);
}

export async function readMyPersonalListings(client: Client, options: OwnedPersonalListingPageOptions = {}, signal?: AbortSignal) {
  const window = pageWindow(options.page, options.pageSize);
  if (options.listingId) requireListingId(options.listingId);
  let request = client.rpc("read_my_personal_listings", {
    p_listing_id: options.listingId ?? null, p_status: options.status ?? null, p_query: options.query ?? "",
    p_category_id: options.categoryId ?? null, p_locality: options.locality ?? null,
    p_province_code: options.provinceCode ?? null, p_from: options.from ?? null, p_until: options.until ?? null,
    p_offset: window.offset, p_limit: window.limit,
  });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw new Error(personalListingError(error));
  return parseListingPage(data, parseOwnedPersonalListing);
}

export async function readMyPersonalListing(client: Client, id: string) {
  requireListingId(id);
  const page = await readMyPersonalListings(client, { listingId: id, pageSize: 1 });
  return page.items[0] ?? null;
}

/** Mantener id al reconciliar una respuesta perdida; no repetir con un UUID nuevo. */
export async function createPersonalListing(client: Client, input: PersonalListingInput, id: string) {
  requireListingId(id);
  const { data, error } = await client.rpc("save_my_personal_listing", {
    p_input: inputPayload(input), p_listing_id: id, p_expected_revision: null,
  });
  if (error) throw new Error(personalListingError(error));
  requireListingId(data);
  return data;
}

export async function updatePersonalListing(client: Client, id: string, revision: number, input: PersonalListingInput) {
  requireListingId(id); requireRevision(revision);
  const { data, error } = await client.rpc("save_my_personal_listing", {
    p_input: inputPayload(input), p_listing_id: id, p_expected_revision: revision,
  });
  if (error) throw new Error(personalListingError(error));
  requireListingId(data);
  return data;
}

export async function managePersonalListing(client: Client, id: string, revision: number, action: PersonalListingAction) {
  requireListingId(id); requireRevision(revision);
  const { data, error } = await client.rpc("manage_my_personal_listing", {
    p_listing_id: id, p_action: action, p_expected_revision: revision,
  });
  if (error) throw new Error(personalListingError(error));
  requireListingId(data);
  return data;
}

export async function reportPersonalListing(client: Client, id: string, reason: PersonalListingReportReason, details = "") {
  requireListingId(id);
  const { data, error } = await client.rpc("report_personal_listing", { p_listing_id: id, p_reason: reason, p_details: details });
  if (error) throw new Error(personalListingError(error));
  requireListingId(data);
  return data;
}

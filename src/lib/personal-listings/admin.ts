import "server-only";

import type { Json } from "@/types/database";
import type { PersonalListingStatus, PersonalListingReportStatus } from "@/types/personal-listings";
import { requireAdmin } from "@/lib/admin/server";
import {
  pageWindow, parseListingPage, parseOwnedPersonalListing, parsePersonalListingAuditLog,
  parsePersonalListingReport, requireListingId,
} from "./contracts";

interface AdminPageOptions { listingId?: string | null; page?: number; pageSize?: number }

async function readSection(section: "listings" | "reports" | "audit", options: AdminPageOptions, status?: string | null): Promise<Json> {
  const client = await requireAdmin("/admin");
  const window = pageWindow(options.page, options.pageSize);
  if (options.listingId) requireListingId(options.listingId);
  const { data, error } = await client.rpc("admin_read_personal_listings", {
    p_section: section, p_listing_id: options.listingId ?? null, p_status: status ?? null,
    p_offset: window.offset, p_limit: window.limit,
  });
  if (error || data === null) {
    // Sólo operación y código, sin contenido de anuncios, contactos, tokens ni notas.
    console.error("[personal listings admin]", { operation: `read ${section}`, code: error?.code ?? "INVALID_RESPONSE" });
    throw new Error("No pudimos abrir esta sección. Volvé a intentar.");
  }
  return data;
}

export async function readAdminPersonalListings(options: AdminPageOptions & { status?: PersonalListingStatus | null } = {}) {
  return parseListingPage(await readSection("listings", options, options.status), parseOwnedPersonalListing);
}
export async function readAdminPersonalListingReports(options: AdminPageOptions & { status?: PersonalListingReportStatus | null } = {}) {
  return parseListingPage(await readSection("reports", options, options.status), parsePersonalListingReport);
}
export async function readAdminPersonalListingAudit(options: AdminPageOptions = {}) {
  return parseListingPage(await readSection("audit", options), parsePersonalListingAuditLog);
}

export async function setPersonalListingBlock(id: string, blocked: boolean, reason = "", note = "") {
  requireListingId(id);
  const client = await requireAdmin("/admin");
  const { error } = await client.rpc("admin_set_personal_listing_block", {
    p_listing_id: id, p_blocked: blocked, p_reason: reason, p_note: note,
  });
  if (error) {
    console.error("[personal listings admin]", { operation: "set block", code: error.code });
    throw new Error("No pudimos cambiar el bloqueo. Revisá los datos y volvé a intentar.");
  }
}
export async function resolvePersonalListingReport(id: string, status: "RESOLVED" | "DISMISSED", note = "") {
  requireListingId(id);
  const client = await requireAdmin("/admin");
  const { error } = await client.rpc("admin_resolve_personal_listing_report", { p_report_id: id, p_status: status, p_note: note });
  if (error) {
    console.error("[personal listings admin]", { operation: "resolve report", code: error.code });
    throw new Error("No pudimos resolver el reporte. Volvé a intentar.");
  }
}

import "server-only";

import { requireAdmin } from "@/lib/admin/server";
import type { ServiceEntity, ServicePagination, ServiceStatus, ServiceReportStatus } from "@/types/services";
import { parseServicePage, parseOwnedServiceProvider, parseOwnedServiceListing, parseServiceReport, parseServiceAudit, requireServiceId, requireServiceRevision, servicePageWindow } from "./contracts";

interface AdminOptions extends ServicePagination { providerId?: string | null; listingId?: string | null }
async function readSection(section: "providers" | "listings" | "reports" | "audit", options: AdminOptions, status?: string | null) {
  if (options.providerId) requireServiceId(options.providerId);
  if (options.listingId) requireServiceId(options.listingId);
  const window = servicePageWindow(options.page, options.pageSize), client = await requireAdmin("/admin");
  const { data, error } = await client.rpc("admin_read_services", { p_section: section, p_provider_id: options.providerId ?? null, p_listing_id: options.listingId ?? null, p_status: status ?? null, p_offset: window.offset, p_limit: window.limit });
  if (error || data === null) {
    console.error("[services admin]", { operation: `read ${section}`, code: error?.code ?? "INVALID_RESPONSE" });
    throw new Error("No pudimos abrir esta sección. Volvé a intentar.");
  }
  return data;
}
export async function readAdminServiceProviders(options: Omit<AdminOptions, "listingId"> & { status?: "ACTIVE" | "INACTIVE" | null } = {}) { return parseServicePage(await readSection("providers", options, options.status), parseOwnedServiceProvider); }
export async function readAdminServiceListings(options: AdminOptions & { status?: ServiceStatus | null } = {}) { return parseServicePage(await readSection("listings", options, options.status), parseOwnedServiceListing); }
export async function readAdminServiceReports(options: AdminOptions & { status?: ServiceReportStatus | null } = {}) { return parseServicePage(await readSection("reports", options, options.status), parseServiceReport); }
export async function readAdminServiceAudit(options: AdminOptions = {}) { return parseServicePage(await readSection("audit", options), parseServiceAudit); }
export async function setServiceBlock(entity: ServiceEntity, id: string, revision: number, blocked: boolean, reason = "", note = "") {
  requireServiceId(id); requireServiceRevision(revision);
  const client = await requireAdmin("/admin");
  const { error } = await client.rpc("admin_set_service_block", { p_entity: entity, p_id: id, p_blocked: blocked, p_expected_revision: revision, p_reason: reason, p_note: note });
  if (error) {
    console.error("[services admin]", { operation: "set block", code: error.code });
    throw new Error(error.code === "40001" ? "La información cambió. Volvé a cargar antes de guardar." : "No pudimos cambiar el bloqueo. Revisá los datos y volvé a intentar.");
  }
}
export async function resolveServiceReport(id: string, revision: number, status: "RESOLVED" | "DISMISSED", note = "") {
  requireServiceId(id); requireServiceRevision(revision);
  const client = await requireAdmin("/admin");
  const { error } = await client.rpc("admin_resolve_service_report", { p_report_id: id, p_status: status, p_expected_revision: revision, p_note: note });
  if (error) {
    console.error("[services admin]", { operation: "resolve report", code: error.code });
    throw new Error(error.code === "40001" ? "El reporte cambió. Volvé a cargarlo." : "No pudimos resolver el reporte. Volvé a intentar.");
  }
}

import "server-only";
import { requireAdmin } from "@/lib/admin/server";
import { requireServiceId, requireServiceRevision } from "@/lib/services/contracts";
import type { ServicePagination } from "@/types/services";
import type { ServiceRequestStatus, ServiceRequestOfferStatus, ServiceRadarReportStatus, ServiceRadarEntity } from "@/types/service-radar";
import { parseAdminServiceRequest, parseAdminServiceRequestOffer, parseServiceRadarReport, parseServiceRadarAudit,
 parseRadarPage, radarPageWindow, serviceRadarError } from "./contracts";

interface AdminOptions extends ServicePagination { requestId?: string | null; offerId?: string | null }
async function readSection(section: "requests" | "offers" | "reports" | "audit", options: AdminOptions, status: string | null = null) {
 if (options.requestId) requireServiceId(options.requestId); if (options.offerId) requireServiceId(options.offerId);
 const page = radarPageWindow(options.page, options.pageSize), client = await requireAdmin("/admin");
 const { data, error } = await client.rpc("admin_read_service_radar", { p_section: section, p_request_id: options.requestId ?? null,
   p_offer_id: options.offerId ?? null, p_status: status, p_offset: page.offset, p_limit: page.limit });
 if (error) { console.error("[service radar admin]", { operation: `read ${section}`, code: error.code }); throw new Error(serviceRadarError(error)); }
 return data;
}
export async function readAdminServiceRequests(options: Omit<AdminOptions, "offerId"> & { status?: ServiceRequestStatus | null } = {}) {
 return parseRadarPage(await readSection("requests", options, options.status), parseAdminServiceRequest);
}
export async function readAdminServiceRequestOffers(options: AdminOptions & { status?: ServiceRequestOfferStatus | null } = {}) {
 return parseRadarPage(await readSection("offers", options, options.status), parseAdminServiceRequestOffer);
}
export async function readAdminServiceRadarReports(options: AdminOptions & { status?: ServiceRadarReportStatus | null } = {}) {
 return parseRadarPage(await readSection("reports", options, options.status), parseServiceRadarReport);
}
export async function readAdminServiceRadarAudit(options: AdminOptions = {}) {
 return parseRadarPage(await readSection("audit", options), parseServiceRadarAudit);
}
export async function setServiceRadarBlock(entity: ServiceRadarEntity, id: string, revision: number, blocked: boolean, reason = "", note = "") {
 requireServiceId(id); requireServiceRevision(revision);
 const client = await requireAdmin("/admin");
 const { error } = await client.rpc("admin_set_service_radar_block", { p_entity: entity, p_id: id, p_blocked: blocked, p_expected_revision: revision, p_reason: reason, p_note: note });
 if (error) { console.error("[service radar admin]", { operation: "set block", code: error.code }); throw new Error(serviceRadarError(error)); }
}
export async function resolveServiceRadarReport(id: string, revision: number, status: "RESOLVED" | "DISMISSED", note = "") {
 requireServiceId(id); requireServiceRevision(revision);
 const client = await requireAdmin("/admin");
 const { error } = await client.rpc("admin_resolve_service_radar_report", { p_report_id: id, p_status: status, p_expected_revision: revision, p_note: note });
 if (error) { console.error("[service radar admin]", { operation: "resolve report", code: error.code }); throw new Error(serviceRadarError(error)); }
}

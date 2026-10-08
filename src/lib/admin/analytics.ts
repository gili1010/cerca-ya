import "server-only";
import { requireAdmin } from "./server";
import { logAdminRpcError } from "./rpc-diagnostics";
export interface AnalyticsSummary { total: number; with_results: number; without_results: number; zero_rate: number }
export interface AnalyticsTerm extends AnalyticsSummary { term: string; display_term: string; last_search: string }
export interface AnalyticsData { summary: AnalyticsSummary; localities: string[]; opportunities: AnalyticsTerm[]; opportunities_total: number; top: AnalyticsTerm[]; top_total: number }
export interface AnalyticsFilters { days: number; locality: string; minimum: number; opportunityPage: number; topPage: number }
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
function summary(value: unknown): value is AnalyticsSummary {
  return object(value) && count(value.total) && count(value.with_results) && count(value.without_results)
    && typeof value.zero_rate === "number" && Number.isFinite(value.zero_rate) && value.zero_rate >= 0 && value.zero_rate <= 100;
}
function terms(value: unknown): value is AnalyticsTerm[] {
  return Array.isArray(value) && value.every(row => summary(row) && object(row)
    && typeof row.term === "string" && typeof row.display_term === "string"
    && typeof row.last_search === "string" && Number.isFinite(Date.parse(row.last_search)));
}
function analyticsData(value: unknown): value is AnalyticsData {
  return object(value) && summary(value.summary) && Array.isArray(value.localities) && value.localities.every(locality => typeof locality === "string")
    && terms(value.opportunities) && terms(value.top) && count(value.opportunities_total) && count(value.top_total);
}
export async function readAnalytics(filters: AnalyticsFilters, returnTo = "/admin/analitica"): Promise<AnalyticsData> {
  const client = await requireAdmin(returnTo);
  try {
    const { data, error } = await client.rpc("admin_search_analytics", {
      p_days: filters.days, p_locality: filters.locality || null, p_min_searches: filters.minimum,
      p_opportunity_page: filters.opportunityPage, p_top_page: filters.topPage,
    });
    if (error) { logAdminRpcError("admin analytics: admin_search_analytics", error); }
    else if (!analyticsData(data)) { logAdminRpcError("admin analytics: response", { code: "INVALID_RPC_RESPONSE", message: "El JSON no cumple el contrato de resumen y tendencias.", details: "Se esperan totales numéricos, arrays y fechas válidas.", hint: "Comparar la definición desplegada de admin_search_analytics con su contrato." }); }
    else return data;
  } catch (error) { logAdminRpcError("admin analytics: request", error); }
  throw new Error("No pudimos cargar la analítica. Volvé a intentar.");
}
export const defaultAnalyticsFilters: AnalyticsFilters = { days: 30, locality: "", minimum: 2, opportunityPage: 1, topPage: 1 };

import "server-only";
import { requireAdmin } from "./server";
export interface AnalyticsSummary { total: number; with_results: number; without_results: number; zero_rate: number }
export interface AnalyticsTerm extends AnalyticsSummary { term: string; display_term: string; last_search: string }
export interface AnalyticsData { summary: AnalyticsSummary; localities: string[]; opportunities: AnalyticsTerm[]; opportunities_total: number; top: AnalyticsTerm[]; top_total: number }
export interface AnalyticsFilters { days: number; locality: string; minimum: number; opportunityPage: number; topPage: number }
export async function readAnalytics(filters: AnalyticsFilters, returnTo = "/admin/analitica"): Promise<AnalyticsData> {
  const client = await requireAdmin(returnTo);
  const { data, error } = await client.rpc("admin_search_analytics", {
    p_days: filters.days, p_locality: filters.locality || null, p_min_searches: filters.minimum,
    p_opportunity_page: filters.opportunityPage, p_top_page: filters.topPage,
  });
  if (error || !data) throw new Error("No pudimos cargar la analítica. Volvé a intentar.");
  return data as unknown as AnalyticsData;
}
export const defaultAnalyticsFilters: AnalyticsFilters = { days: 30, locality: "", minimum: 2, opportunityPage: 1, topPage: 1 };

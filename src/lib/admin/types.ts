export const adminReasons = ["Contenido prohibido", "Datos falsos", "Incumplimiento", "Solicitud del propietario", "Otro"] as const;
export type AdminEntity = "business" | "product";
export type AdminState = "all" | "active" | "inactive" | "blocked";
export type AdminParams = Record<string, string | string[] | undefined>;
export type AdminFilters = { query: string; businessQuery: string; state: AdminState; page: number };
export type AdminPage<T> = { total: number; rows: T[] };
export type AdminMetrics = { users: number; businesses: number; active_businesses: number; active_products: number; orders: number; recent_orders: number; active_users: number; suspended_users: number; open_reports: number };
export type AdminBusiness = {
  id: string; name: string; slug: string; city: string | null; description: string | null;
  active: boolean; verified: boolean; admin_suspended_at: string | null; created_at: string;
  pickup_enabled: boolean; delivery_enabled: boolean; owner_name: string | null;
  product_count: number; categories: string[];
};
export type AdminProduct = {
  id: string; name: string; business_id: string; business_name: string; business_active: boolean;
  category_name: string; price: number; inventory_mode: "STOCKED" | "ON_DEMAND";
  active: boolean; admin_blocked_at: string | null; created_at: string; image_url: string | null;
};
export type AdminAudit = {
  id: string; admin_user_id: string; admin_name: string | null;
  action: "BUSINESS_SUSPENDED" | "BUSINESS_REACTIVATED" | "BUSINESS_VERIFIED" | "BUSINESS_UNVERIFIED" | "PRODUCT_BLOCKED" | "PRODUCT_UNBLOCKED" | "USER_SUSPENDED" | "USER_REACTIVATED" | "REPORT_RESOLVED" | "REPORT_DISMISSED";
  entity_type: AdminEntity | "user" | "report"; entity_id: string; resource_name: string | null;
  reason: string; note: string | null; created_at: string;
};
export const adminPageSize = 25;
export function parseAdminFilters(params: AdminParams): AdminFilters {
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : "";
  const state = value("estado");
  const page = Number(value("pagina"));
  return {
    query: value("q").trim().slice(0, 160), businessQuery: value("comercio").trim().slice(0, 160),
    state: ["active", "inactive", "blocked"].includes(state) ? state as AdminState : "all",
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 40001) : 1,
  };
}
export function adminPageHref(path: string, filters: AdminFilters, page: number) {
  const params = new URLSearchParams({ pagina: String(page) });
  if (filters.query) params.set("q", filters.query);
  if (filters.businessQuery) params.set("comercio", filters.businessQuery);
  if (filters.state !== "all") params.set("estado", filters.state);
  return `${path}?${params}`;
}

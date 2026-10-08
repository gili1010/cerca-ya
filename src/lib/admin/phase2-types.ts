import type { AdminParams } from "./types";
import type { ReservationStatus } from "@/types/reservations";
export const userSuspensionReasons = ["Abuso de la plataforma", "Spam", "Fraude", "Contenido prohibido", "Incumplimiento", "Otro"] as const;
export const reportReasons = ["Información incorrecta", "Producto prohibido o inapropiado", "Posible estafa", "Comercio inexistente", "Contenido ofensivo", "Otro"] as const;
export type ReportStatus = "OPEN" | "RESOLVED" | "DISMISSED";
export type SupportFilters = { q: string; buyer: string; business: string; state: string; mode: string; from: string; to: string; page: number };
export type AdminUser = {
  id: string; name: string | null; email: string | null; phone: string | null; created_at: string;
  suspended_at: string | null; is_admin: boolean; order_count: number;
  businesses: { id: string; name: string }[];
  recent_orders: { id: string; created_at: string; status: ReservationStatus; total: number; business_name: string }[];
};
export type AdminOrder = {
  id: string; created_at: string; status: ReservationStatus; total: number; delivery_type: "PICKUP" | "DELIVERY";
  buyer_id: string; buyer_name: string | null; business_id: string; business_name: string; item_count: number;
  confirmed_at: string | null; ready_at: string | null; completed_at: string | null; cancelled_at: string | null;
  expires_at: string;
  items: { name: string; quantity: number; unit_price: number; subtotal: number; image_url: string | null }[];
  checkout: {
    customer_name: string; customer_phone: string; delivery_address: string | null; delivery_city: string | null;
    delivery_reference: string | null; payment_method: "CASH" | "TRANSFER" | "ARRANGE";
    pickup_address: string | null; pickup_city: string | null;
  } | null;
};
export type AdminReport = {
  id: string; reporter_user_id: string; reporter_name: string | null; entity_type: "business" | "product";
  entity_id: string; reason: string; status: ReportStatus; created_at: string; resource_name: string | null;
  details: string | null; resolution_note: string | null; resolved_at: string | null; resolved_by: string | null;
  business_slug: string | null; business_id: string | null;
};
export const orderStatusLabels: Record<ReservationStatus, string> = { PENDING: "Pendiente", CONFIRMED: "Confirmado", READY: "Listo", COMPLETED: "Completado", CANCELLED: "Cancelado", EXPIRED: "Vencido" };
export const reportStatusLabels: Record<ReportStatus, string> = { OPEN: "Pendiente", RESOLVED: "Resuelto", DISMISSED: "Descartado" };
export const shortOrderId = (id: string) => id.replaceAll("-", "").slice(0, 6).toUpperCase();
export const validAdminId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export function parseSupportFilters(params: AdminParams, section: "users" | "orders" | "reports"): SupportFilters {
  const val = (key: string) => typeof params[key] === "string" ? (params[key] as string).trim().slice(0, 160) : "";
  const states = section === "users" ? ["active", "suspended"] : section === "reports" ? ["OPEN", "RESOLVED", "DISMISSED"] : Object.keys(orderStatusLabels);
  const state = val("estado");
  const page = Number(val("pagina"));
  const date = (key: string) => {
    const text = val(key);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) && text.slice(0, 4) >= "1900" && !Number.isNaN(Date.parse(text)) && new Date(text).toISOString().slice(0, 10) === text ? text : "";
  };
  const from = date("desde"), to = date("hasta");
  return { q: val("q"), buyer: val("comprador"), business: val("comercio"),
    state: states.includes(state) ? state : section === "reports" && state !== "all" ? "OPEN" : "all",
    mode: ["PICKUP", "DELIVERY"].includes(val("modalidad")) ? val("modalidad") : "all",
    from: from && to && from > to ? "" : from, to: from && to && from > to ? "" : to,
    page: Number.isSafeInteger(page) && page > 0 ? Math.min(page, 40001) : 1,
  };
}
export function supportHref(path: string, filters: SupportFilters, page: number) {
  const params = new URLSearchParams({ pagina: String(page) });
  const values = { q: filters.q, comprador: filters.buyer, comercio: filters.business, estado: filters.state, modalidad: filters.mode, desde: filters.from, hasta: filters.to };
  Object.entries(values).forEach(([key, value]) => { if (value && value !== "all") params.set(key, value); });
  // En Reportes "all" debe conservarse porque OPEN es el predeterminado.
  if (path === "/admin/reportes" && filters.state === "all") params.set("estado", "all");
  return `${path}?${params}`;
}

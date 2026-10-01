import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRow, Database, DatabaseNeededWhen, DatabaseRequestStatus, RequestRow } from "@/types/database";

export const requestUrgencies: Record<DatabaseNeededWhen, string> = { TODAY: "Lo necesito hoy", TOMORROW: "Mañana", THIS_WEEK: "Esta semana", FLEXIBLE: "No tengo apuro" };
export const requestRadii = [5, 10, 20, 30];
export const requestsPageSize = 20;
export type BuyerRequestFilter = "ALL" | DatabaseRequestStatus;
export type BuyerRequestInput = Pick<RequestRow, "title" | "description" | "category_id" | "radius_km" | "needed_when">;
export type BuyerRequest = RequestRow & { category: Pick<CategoryRow, "name"> | null; offers: { count: number }[] };
export function displayedRequestStatus(request: RequestRow, now: number): DatabaseRequestStatus {
  return request.status === "OPEN" && Date.parse(request.expires_at) <= now ? "EXPIRED" : request.status;
}
export function validateBuyerRequest(input: BuyerRequestInput, categories: CategoryRow[]) {
  if (input.title.trim().length < 3 || input.title.trim().length > 120) return "Escribí un título de entre 3 y 120 caracteres.";
  if (input.description.length > 1000) return "La descripción puede tener hasta 1000 caracteres.";
  if (!categories.some(category => category.id === input.category_id)) return "Elegí una categoría válida.";
  if (!requestRadii.includes(input.radius_km)) return "Elegí un radio válido.";
  if (!(input.needed_when in requestUrgencies)) return "Elegí cuándo lo necesitás.";
  return "";
}
export async function readBuyerRequests(client: SupabaseClient<Database>, userId: string, filter: BuyerRequestFilter, page: number, id?: string) {
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return { requests: [], total: 0 };
  let query = client.from("requests").select("*, category:categories(name), offers(count)", { count: "exact" }).eq("buyer_id", userId);
  const now = new Date().toISOString();
  if (id) query = query.eq("id", id);
  else if (filter === "OPEN") query = query.eq("status", "OPEN").gt("expires_at", now);
  else if (filter === "EXPIRED") query = query.or(`status.eq.EXPIRED,and(status.eq.OPEN,expires_at.lte.${now})`);
  else if (filter !== "ALL") query = query.eq("status", filter);
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range(page * requestsPageSize, (page + 1) * requestsPageSize - 1);
  if (error) throw error;
  return { requests: data, total: count ?? 0 };
}

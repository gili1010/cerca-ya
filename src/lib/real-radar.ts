import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow, Database, ProductRow, RadarRequestRow } from "@/types/database";
import { isUuid } from "./real-offers";

export type RealRadarData = { requests: RadarRequestRow[]; products: ProductRow[]; categories: string[] };
export type RealOpportunity = { request: RadarRequestRow; categoryMatch: boolean; product?: ProductRow };
export type RealRadarFilter = "all" | "today" | "catalog";
export type RealRadarDistanceFilter = "all" | "5" | "10" | "radius";
export type RealRadarOrder = "recent" | "urgent" | "distance";
export function canOfferProduct(product: ProductRow, business: BusinessRow) {
  return product.active && product.stock_quantity > 0 && product.stock_status !== "OUT_OF_STOCK"
    && ((product.pickup_enabled && business.pickup_enabled) || (product.delivery_enabled && business.delivery_enabled));
}
export async function readRadarRequests(client: SupabaseClient<Database>, requestId?: string) {
    if (requestId && !isUuid(requestId)) return [];
    const rows: RadarRequestRow[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.rpc("read_radar", { p_request_id: requestId ?? null, p_offset: offset, p_limit: 100 });
      if (error) throw error;
      rows.push(...data);
      if (data.length < 100) return [...new Map(rows.map(row => [row.id, row])).values()];
    }
}
export async function readRealRadar(client: SupabaseClient<Database>, businessId: string, requestId?: string): Promise<RealRadarData> {
  if (requestId && !isUuid(requestId)) return { requests: [], products: [], categories: [] };
  const readProducts = async () => {
    const rows: ProductRow[] = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await client.from("products").select("*").eq("business_id", businessId).eq("active", true).order("id").range(offset, offset + 99);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 100) return rows;
    }
  };
  const [requests, products, categoryResult] = await Promise.all([readRadarRequests(client, requestId), readProducts(), client.from("business_categories").select("category_id").eq("business_id", businessId)]);
  if (categoryResult.error) throw categoryResult.error;
  return { requests, products, categories: categoryResult.data.map(row => row.category_id) };
}
const ignored = new Set(["de", "del", "la", "las", "el", "los", "un", "una", "para", "por", "con", "que", "necesito", "busco", "hoy", "tengo"]);
function terms(text: string) {
  return [...new Set(text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length > 1 && !ignored.has(term)))];
}
export function realOpportunities(data: RealRadarData, business: BusinessRow, now: number): RealOpportunity[] {
  return data.requests.filter(request => Date.parse(request.expires_at) > now).map(request => {
    const title = terms(request.title);
    const words = new Set(terms(`${request.title} ${request.description}`));
    const matches = data.products.filter(product => canOfferProduct(product, business)).map(product => {
      const productTerms = terms(`${product.name} ${product.brand ?? ""} ${product.model ?? ""}`);
      const overlap = productTerms.filter(term => words.has(term));
      // Category alone is insufficient to suggest a product: require lexical evidence.
      const score = overlap.length ? overlap.length * 2 + productTerms.filter(term => title.includes(term)).length * 3 + (product.category_id === request.category_id ? 3 : 0) : 0;
      return { product, score };
    }).filter(match => match.score > 0).sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name));
    return { request, categoryMatch: data.categories.includes(request.category_id), product: matches[0]?.product };
  });
}
export function filterRealRadar(rows: RealOpportunity[], filter: RealRadarFilter, order: RealRadarOrder, distanceFilter: RealRadarDistanceFilter = "all") {
  const urgency = { TODAY: 0, TOMORROW: 1, THIS_WEEK: 2, FLEXIBLE: 3 };
  // Distance was calculated AND the buyer's radius enforced in PostgreSQL.
  // These optional display filters only compare that safe scalar, never coordinates.
  return rows.filter(row => filter === "today" ? row.request.needed_when === "TODAY" : filter === "catalog" ? Boolean(row.product) : true)
    .filter(({ request }) => distanceFilter === "all" || (request.distance_km !== null && request.distance_km <= (distanceFilter === "radius" ? request.radius_km : Number(distanceFilter))))
    .sort((a, b) => (order === "distance" ? (a.request.distance_km ?? Infinity) - (b.request.distance_km ?? Infinity) : 0)
      || Number(b.categoryMatch) - Number(a.categoryMatch)
      || (order === "urgent" ? urgency[a.request.needed_when] - urgency[b.request.needed_when] : 0)
      || Date.parse(b.request.created_at) - Date.parse(a.request.created_at) || a.request.id.localeCompare(b.request.id));
}

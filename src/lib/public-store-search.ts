import { catalogRadius, type HyperlocalScope } from "./hyperlocal";
import { isCoordinates } from "./location";
import { provinceByCode } from "./argentina-provinces";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow, CategoryRow, Database } from "@/types/database";

export const storeSearchLimit = 8;
type StoreCategory = Pick<CategoryRow, "id" | "name" | "slug">;
export type StoreSearchBusiness = Pick<BusinessRow,
  "id" | "slug" | "name" | "city" | "logo_url" | "pickup_enabled" | "delivery_enabled" | "latitude" | "longitude" | "verified"
> & { categories: StoreCategory[] };

// Optional columns are omitted until needed (distance) or available (logo).
type SearchRow = Omit<StoreSearchBusiness, "categories" | "logo_url" | "latitude" | "longitude">
  & Partial<Pick<StoreSearchBusiness, "logo_url" | "latitude" | "longitude">>
  & { business_categories: { category: StoreCategory | null }[] };

export async function searchPublicStores(client: SupabaseClient<Database>, query: string, scope: HyperlocalScope & { group?: "distance" | "locality" }, signal?: AbortSignal): Promise<StoreSearchBusiness[]> {
  const term = query.trim().slice(0, 160);
  const coordinates = isCoordinates(scope.buyerLocation) ? scope.buyerLocation : null;
  const group = scope.group ?? "distance";
  const locality = scope.locality?.trim() || null;
  const provinceCode = provinceByCode(scope.provinceCode)?.code ?? null;
  if (!term || (group === "distance" ? !coordinates : !locality || !provinceCode)) return [];
  // Accent-insensitive matching and the eight-result cap stay in PostgreSQL.
  // The RPC returns only the same public fields used by these cards.
  let request = client.rpc("search_public_stores", { p_query: term, p_with_distance: group === "distance" && Boolean(coordinates), p_latitude: coordinates?.latitude ?? null, p_longitude: coordinates?.longitude ?? null, p_radius_km: group === "locality" ? 20 : catalogRadius(scope.radiusKm ?? 20), p_locality: locality, p_province_code: provinceCode, p_group: group });
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (error) throw error;
  const rows: SearchRow[] = data ?? [];

  return rows
    .map(row => ({
      id: row.id, slug: row.slug, name: row.name, city: row.city, verified: row.verified,
      logo_url: row.logo_url ?? null, pickup_enabled: row.pickup_enabled, delivery_enabled: row.delivery_enabled,
      latitude: group === "locality" ? null : row.latitude ?? null, longitude: group === "locality" ? null : row.longitude ?? null,
      categories: [...new Map(row.business_categories.flatMap(relation => relation.category ? [[relation.category.id, relation.category] as const] : [])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "es-AR")),
    }));
}

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow, CategoryRow, Database } from "@/types/database";

export const storeSearchLimit = 8;
type StoreCategory = Pick<CategoryRow, "id" | "name" | "slug">;
export type StoreSearchBusiness = Pick<BusinessRow,
  "id" | "slug" | "name" | "city" | "logo_url" | "pickup_enabled" | "delivery_enabled" | "latitude" | "longitude"
> & { categories: StoreCategory[] };

// Optional columns are omitted until needed (distance) or available (logo).
type SearchRow = Omit<StoreSearchBusiness, "categories" | "logo_url" | "latitude" | "longitude">
  & Partial<Pick<StoreSearchBusiness, "logo_url" | "latitude" | "longitude">>
  & { business_categories: { category: StoreCategory | null }[] };

export async function searchPublicStores(client: SupabaseClient<Database>, query: string, withDistance: boolean, signal?: AbortSignal): Promise<StoreSearchBusiness[]> {
  const term = query.trim().slice(0, 160);
  if (!term) return [];
  const escaped = term.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escaped}%`;

  async function readBusinesses(mode: "exact" | "prefix" | "name" | "details" | "category", categoryIds: string[] = [], withLogo = true): Promise<SearchRow[]> {
    // No owner, contact, address or internal fields. Buyer coordinates never leave the browser.
    const fields = [
      "id,slug,name,city,pickup_enabled,delivery_enabled",
      "business_categories(category:categories(id,name,slug))",
      ...(withLogo ? ["logo_url"] : []),
      ...(withDistance ? ["latitude,longitude"] : []),
      ...(mode === "category" ? ["match:business_categories!inner(category_id)"] : []),
    ].join(",");
    let request = client.from("businesses").select(fields).eq("active", true)
      .order("name").order("id").limit(storeSearchLimit);
    if (mode === "exact") request = request.ilike("name", escaped);
    if (mode === "prefix") request = request.ilike("name", `${escaped}%`);
    if (mode === "name") request = request.ilike("name", pattern);
    if (mode === "details") {
      const quoted = JSON.stringify(pattern);
      request = request.or(`description.ilike.${quoted},city.ilike.${quoted}`);
    }
    if (mode === "category") request = request.in("match.category_id", categoryIds);
    if (signal) request = request.abortSignal(signal);
    // The selection varies only by the explicitly optional public columns above.
    const { data, error } = await request.overrideTypes<SearchRow[], { merge: false }>();
    if (error && withLogo && ["42703", "PGRST204"].includes(error.code)) {
      return readBusinesses(mode, categoryIds, false);
    }
    if (error) throw error;
    return data ?? [];
  }

  const matches = new Map<string, SearchRow>();
  const add = (rows: SearchRow[]) => rows.forEach(row => matches.set(row.id, row));
  // Preserve exact and prefix matches even when broader matches reach the limit.
  const [exact, prefix, named] = await Promise.all([readBusinesses("exact"), readBusinesses("prefix"), readBusinesses("name")]);
  add(named); add(prefix); add(exact);
  if (matches.size < storeSearchLimit) {
    let categoriesQuery = client.from("categories").select("id").ilike("name", pattern).order("name").limit(32);
    if (signal) categoriesQuery = categoriesQuery.abortSignal(signal);
    const [details, categories] = await Promise.all([readBusinesses("details"), categoriesQuery]);
    if (categories.error) throw categories.error;
    add(details);
    if (categories.data?.length) add(await readBusinesses("category", categories.data.map(category => category.id)));
  }

  const lowerTerm = term.toLocaleLowerCase("es-AR");
  const priority = (name: string) => {
    const lowerName = name.trim().toLocaleLowerCase("es-AR");
    return lowerName === lowerTerm ? 0 : lowerName.startsWith(lowerTerm) ? 1 : lowerName.includes(lowerTerm) ? 2 : 3;
  };
  return [...matches.values()]
    .sort((a, b) => priority(a.name) - priority(b.name) || a.name.localeCompare(b.name, "es-AR") || a.id.localeCompare(b.id))
    .slice(0, storeSearchLimit)
    .map(row => ({
      id: row.id, slug: row.slug, name: row.name, city: row.city,
      logo_url: row.logo_url ?? null, pickup_enabled: row.pickup_enabled, delivery_enabled: row.delivery_enabled,
      latitude: row.latitude ?? null, longitude: row.longitude ?? null,
      categories: [...new Map(row.business_categories.flatMap(relation => relation.category ? [[relation.category.id, relation.category] as const] : [])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "es-AR")),
    }));
}

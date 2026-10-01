import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product, QuickFilter, SortOrder } from "@/lib/products";
import { businessDistance } from "@/lib/distance";
import { isCoordinates, type Coordinates } from "@/lib/location";

export const publicPageSize = 12;
export const placeholderImage = "/product-placeholder.svg";
export const isProductUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
const selection = "*, business:businesses!inner(id,name,city,address,latitude,longitude,whatsapp,pickup_enabled,delivery_enabled,delivery_price,active), category:categories!inner(*), product_images(url,position)";

function publicQuery(client: SupabaseClient<Database>, head = false) {
  // Explicit active checks apply even to owners, whose RLS also permits inactive rows.
  return client.from("products").select(selection, { count: "exact", head }).eq("active", true).eq("business.active", true);
}
type JoinedProduct = NonNullable<Awaited<ReturnType<typeof publicQuery>>["data"]>[number];

export function validImageUrl(value: string): boolean {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}

function toProduct(row: JoinedProduct, buyerLocation: Coordinates | null = null): Product {
  const { business, category, product_images: images, ...product } = row;
  const firstImage = images.find(image => image.position === 0 && validImageUrl(image.url));
  return {
    id: product.id, name: product.name, category: category.name, store: business.name, storeId: business.id,
    price: product.price, stock: product.stock_quantity, description: product.description,
    image: firstImage?.url ?? placeholderImage, distanceKm: businessDistance(buyerLocation, business), confirmedMinutesAgo: null,
    pickupToday: product.pickup_enabled && business.pickup_enabled,
    deliveryToday: product.delivery_enabled && business.delivery_enabled,
    deliveryPrice: business.delivery_price, pickupMinutes: null,
    source: "supabase", database: { product, business, category },
  };
}

export interface PublicCatalogOptions {
  query: string; category: string; filters: QuickFilter[]; sort: SortOrder; page: number;
  favoriteIds?: string[];
  // Browser-only input. Never included in a Supabase query, URL or persisted row.
  buyerLocation?: Coordinates | null;
}

export async function getPublicCategories(client: SupabaseClient<Database>) {
  const { data, error } = await client.from("categories").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function getPublicCatalog(client: SupabaseClient<Database>, options: PublicCatalogOptions, signal?: AbortSignal) {
  const buyerLocation = isCoordinates(options.buyerLocation) ? options.buyerLocation : null;
  const mapProduct = (row: JoinedProduct) => toProduct(row, buyerLocation);
  const ids = options.favoriteIds?.filter(isProductUuid);
  if (ids && !ids.length) return { products: [], total: 0 };
  // Quote PostgREST values and escape LIKE wildcards, keeping input literal.
  const term = options.query.trim().slice(0, 160).replace(/[\\%_]/g, "\\$&");
  const pattern = JSON.stringify(`%${term}%`);
  function query(head = false) {
    let request = publicQuery(client, head);
    if (term) request = request.or(["name", "brand", "model", "description"].map(field => `${field}.ilike.${pattern}`).join(","));
    if (options.category) request = request.eq("category.slug", options.category);
    if (ids) request = request.in("id", ids);
    if (options.filters.includes("delivery")) request = request.eq("delivery_enabled", true).eq("business.delivery_enabled", true);
    if (options.filters.includes("pickup")) request = request.eq("pickup_enabled", true).eq("business.pickup_enabled", true);
    if (options.filters.includes("confirmed")) request = request.not("stock_confirmed_at", "is", null);
    if (options.filters.includes("today")) request = request.gt("stock_quantity", 0).neq("stock_status", "OUT_OF_STOCK");
    if (signal) request = request.abortSignal(signal);
    return request;
  }
  const offset = Math.max(0, options.page) * publicPageSize;
  const ordered = (request: ReturnType<typeof query>) => request.order("stock_confirmed_at", { ascending: false, nullsFirst: false }).order("id");
  if (buyerLocation && (options.filters.includes("nearby") || options.sort === "distance")) {
    // Download every matching public candidate before local filtering/sorting.
    // Slicing a server page first would silently omit closer products on later pages.
    const candidates: Product[] = [];
    let start = 0;
    while (true) {
      const { data, error, count } = await query().order("id").range(start, start + 499);
      if (error) throw error;
      const rows = data ?? [];
      candidates.push(...rows.map(mapProduct));
      start += rows.length;
      if (!rows.length || (count !== null && start >= count)) break;
    }
    const products = options.filters.includes("nearby")
      ? candidates.filter(product => product.distanceKm !== null && product.distanceKm <= 5)
      : candidates;
    const confirmedTime = (product: Product) => product.database?.product.stock_confirmed_at
      ? Date.parse(product.database.product.stock_confirmed_at) : -Infinity;
    products.sort((a, b) => {
      const primary = options.sort === "distance" ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
        : options.sort === "price" ? a.price - b.price : Number(b.stock > 0) - Number(a.stock > 0);
      return primary || (confirmedTime(b) - confirmedTime(a)) || a.id.localeCompare(b.id);
    });
    return { products: products.slice(offset, offset + publicPageSize), total: products.length };
  }
  if (options.sort === "price" || options.filters.includes("today")) {
    let request = query();
    if (options.sort === "price") request = request.order("price");
    const { data, error, count } = await ordered(request).range(offset, offset + publicPageSize - 1);
    if (error) throw error;
    return { products: (data ?? []).map(mapProduct), total: count ?? 0 };
  }
  // Two disjoint stock groups keep positive stock first without ranking by quantity.
  const available = await ordered(query().gt("stock_quantity", 0)).range(offset, offset + publicPageSize - 1);
  if (available.error) throw available.error;
  const rows = available.data ?? [];
  const remaining = publicPageSize - rows.length;
  const zeroOffset = Math.max(0, offset - (available.count ?? 0));
  const unavailable = await ordered(query(remaining === 0).eq("stock_quantity", 0)).range(zeroOffset, zeroOffset + Math.max(remaining, 1) - 1);
  if (unavailable.error) throw unavailable.error;
  return { products: [...rows, ...(remaining ? unavailable.data ?? [] : [])].map(mapProduct), total: (available.count ?? 0) + (unavailable.count ?? 0) };
}

export async function getPublicProduct(client: SupabaseClient<Database>, id: string) {
  if (!isProductUuid(id)) return null;
  const { data, error } = await publicQuery(client).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : null;
}

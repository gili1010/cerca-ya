import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Product, QuickFilter, SortOrder } from "@/lib/products";
import { businessDistance } from "@/lib/distance";
import { isCoordinates, type Coordinates } from "@/lib/location";

export const publicHomePageSize = 12;
export const publicSearchPageSize = 24;
// Existing saved-products pagination uses the non-Home page size.
export const publicPageSize = publicSearchPageSize;
export function publicCatalogPageSize(home = false) { return home ? publicHomePageSize : publicSearchPageSize; }
export const placeholderImage = "/product-placeholder.svg";
export const isProductUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
// Public presentation fields only: no owner ID, SKU or internal timestamps.
const selection = "id,business_id,category_id,name,description,brand,model,price,stock_quantity,stock_status,stock_confirmed_at,inventory_mode,available_today,availability_confirmed_at,pickup_enabled,delivery_enabled,active, business:businesses!inner(id,slug,name,city,address,latitude,longitude,whatsapp,pickup_enabled,delivery_enabled,delivery_price,active), category:categories!inner(id,name,slug), product_images(url,position)";

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
  home?: boolean;
  // Transient read parameters for server pagination; never put in a URL or row.
  buyerLocation?: Coordinates | null;
}

export async function getPublicCategories(client: SupabaseClient<Database>) {
  const { data, error } = await client.from("categories").select("*").order("name");
  if (error) throw error;
  return data;
}

export async function getPublicCatalog(client: SupabaseClient<Database>, options: PublicCatalogOptions, signal?: AbortSignal) {
  const buyerLocation = isCoordinates(options.buyerLocation) ? options.buyerLocation : null;
  const ids = options.favoriteIds?.filter(isProductUuid);
  const home = options.home === true && !options.query.trim();
  const pageSize = publicCatalogPageSize(home);
  if (ids && !ids.length) return { products: [], total: 0, pageSize };
  const page = Number.isFinite(options.page) ? Math.max(0, Math.floor(options.page)) : 0;
  let request = client.rpc("read_marketplace_page", {
    p_query: options.query.trim().slice(0, 160), p_category: options.category,
    p_filters: options.filters, p_sort: options.sort, p_home: home,
    p_favorite_ids: ids ?? null, p_latitude: buyerLocation?.latitude ?? null, p_longitude: buyerLocation?.longitude ?? null,
    p_offset: page * pageSize, p_limit: pageSize,
  });
  if (signal) request = request.abortSignal(signal);
  const { data: result, error } = await request;
  if (error) throw error;
  const selected = result?.[0];
  const productIds = selected?.product_ids ?? [];
  if (!productIds.length) return { products: [], total: selected?.total ?? 0, pageSize };
  // Only hydrate IDs from this server page. No full-catalog download fallback.
  let details = publicQuery(client).in("id", productIds).limit(pageSize);
  if (signal) details = details.abortSignal(signal);
  const { data: rows, error: detailError } = await details;
  if (detailError) throw detailError;
  const byId = new Map((rows ?? []).map(row => [row.id, row]));
  const products = productIds.flatMap(id => { const row = byId.get(id); return row ? [toProduct(row, buyerLocation)] : []; });
  return { products, total: selected?.total ?? 0, pageSize };
}

export async function getPublicProduct(client: SupabaseClient<Database>, id: string) {
  if (!isProductUuid(id)) return null;
  const { data, error } = await publicQuery(client).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : null;
}

export async function getPublicStoreProducts(client: SupabaseClient<Database>, businessId: string): Promise<Product[]> {
  // Same catalog rows and mapping; scope to one active business. Fetch all batches
  // before client-side search, so Supabase's row limit cannot hide store products.
  const products: Product[] = [];
  let start = 0;
  while (true) {
    const { data, error, count } = await publicQuery(client).eq("business_id", businessId)
      .order("name").order("id").range(start, start + 499);
    if (error) throw error;
    const rows = data ?? [];
    products.push(...rows.map(row => toProduct(row)));
    start += rows.length;
    if (!rows.length || (count !== null && start >= count)) break;
  }
  return products;
}


import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessRow, Database } from "@/types/database";
import { getPublicStoreProducts, isProductUuid } from "./public-catalog";
import type { Product } from "./products";

// Only public fields needed for the existing checkout; no owner ID or coordinates.
export type CartBusiness = Pick<BusinessRow, "id" | "name" | "slug" | "city" | "address" | "pickup_enabled" | "delivery_enabled" | "delivery_price" | "minimum_order" | "accepts_cash" | "accepts_transfer" | "active">;
export async function getCartCatalog(client: SupabaseClient<Database>, businessId: string): Promise<{ business: CartBusiness | null; products: Product[] }> {
  if (!isProductUuid(businessId)) return { business: null, products: [] };
  const { data: business, error } = await client.from("businesses")
    .select("id,name,slug,city,address,pickup_enabled,delivery_enabled,delivery_price,minimum_order,accepts_cash,accepts_transfer,active")
    .eq("id", businessId).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!business) return { business: null, products: [] };
  return { business, products: await getPublicStoreProducts(client, businessId) };
}

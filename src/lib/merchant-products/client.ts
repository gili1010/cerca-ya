"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getBusinessFormData } from "@/lib/businesses/client";

export const productPageSize = 24;

export async function getMerchantProducts(client: SupabaseClient<Database>, businessId: string, page: number) {
  // The filter is necessary even with RLS: active products from OTHER businesses are public.
  const [products, categories] = await Promise.all([
    client.from("products").select("*", { count: "exact" }).eq("business_id", businessId)
      .order("created_at", { ascending: false }).order("id").range(page * productPageSize, (page + 1) * productPageSize - 1),
    client.from("categories").select("*").order("name"),
  ]);
  if (products.error) throw products.error;
  if (categories.error) throw categories.error;
  return { products: products.data, categories: categories.data, total: products.count ?? 0 };
}

export async function getMerchantProductForm(client: SupabaseClient<Database>, businessId: string, productId?: string) {
  const [catalog, product, image] = await Promise.all([
    getBusinessFormData(client, businessId),
    productId ? client.from("products").select("*").eq("business_id", businessId).eq("id", productId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    productId ? client.from("product_images").select("*").eq("product_id", productId).eq("position", 0).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (product.error) throw product.error;
  if (image.error) throw image.error;
  return { ...catalog, product: product.data, image: product.data ? image.data : null };
}

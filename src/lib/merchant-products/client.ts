"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getBusinessFormData } from "@/lib/businesses/client";

export const productPageSize = 24;

export async function getActiveProductCount(client: SupabaseClient<Database>, businessId: string) {
  const result = await client.from("products").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("active", true);
  if (result.error) throw result.error;
  if (result.count === null) throw new Error("product_count_unavailable");
  return result.count;
}

export async function getMerchantProducts(client: SupabaseClient<Database>, businessId: string, page: number) {
  // The filter is necessary even with RLS: active products from OTHER businesses are public.
  const [products, categories, activeCount] = await Promise.all([
    client.from("products").select("*,product_images(url,position)", { count: "exact" }).eq("business_id", businessId)
      .order("created_at", { ascending: false }).order("id").range(page * productPageSize, (page + 1) * productPageSize - 1),
    client.from("categories").select("*").order("name"),
    getActiveProductCount(client, businessId),
  ]);
  if (products.error) throw products.error;
  if (categories.error) throw categories.error;
  // Keep photos separate so the existing product-action response can replace a row
  // without losing the image already loaded in this same paginated request.
  const entries = products.data.map(({ product_images, ...product }) => ({
    product, image: product_images.find(image => image.position === 0)?.url ?? null,
  }));
  return { products: entries.map(entry => entry.product), imageUrls: Object.fromEntries(entries.map(entry => [entry.product.id, entry.image])), categories: categories.data, activeCount, total: products.count ?? 0 };
}

export async function getMerchantProductForm(client: SupabaseClient<Database>, businessId: string, productId?: string) {
  const [catalog, product, image, activeCount] = await Promise.all([
    getBusinessFormData(client, businessId),

    productId ? client.from("products").select("*").eq("business_id", businessId).eq("id", productId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    productId ? client.from("product_images").select("*").eq("product_id", productId).eq("position", 0).maybeSingle() : Promise.resolve({ data: null, error: null }),
    getActiveProductCount(client, businessId),
  ]);
  if (product.error) throw product.error;
  if (image.error) throw image.error;
  return { ...catalog, activeCount, product: product.data, image: product.data ? image.data : null };
}

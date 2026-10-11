import "server-only";
import { cache } from "react";
import type { BusinessRow, CategoryRow } from "@/types/database";
import type { Product } from "@/lib/products";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicStoreProducts } from "@/lib/public-catalog";
import { readBusinessHours } from "@/lib/business-hours-client";
import type { BusinessHoursSchedule } from "@/lib/business-hours";

export type PublicStoreBusiness = Pick<BusinessRow,
  "id" | "slug" | "name" | "description" | "city" | "latitude" | "longitude" |
  "whatsapp" | "pickup_enabled" | "delivery_enabled" | "delivery_price" | "logo_url" | "cover_url" | "verified" | "instagram_url" | "facebook_url"
>;
export interface PublicStore {
  hours: BusinessHoursSchedule | null;
  business: PublicStoreBusiness;
  categories: Pick<CategoryRow, "id" | "name" | "slug">[];
  products: Product[];
}

// Per-request only: metadata and page share the result, without caching stock
// across requests. Caller permissions/RLS apply; no service-role client.
export const loadPublicStore = cache(async (slug: string): Promise<{ store: PublicStore | null; error: boolean }> => {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { store: null, error: false };
  try {
    const client = await createSupabaseServerClient();
    if (!client) throw new Error("unavailable");
    let { data: business, error } = await client.from("businesses")
      .select("id,slug,name,description,city,latitude,longitude,whatsapp,pickup_enabled,delivery_enabled,delivery_price,logo_url,cover_url,verified,instagram_url,facebook_url")
      .eq("slug", slug).eq("active", true).maybeSingle();
    // Optional social-link delta may not have been applied yet; preserve branding.
    if (error && ["42703", "PGRST204"].includes(error.code)) {
      const previous = await client.from("businesses")
        .select("id,slug,name,description,city,latitude,longitude,whatsapp,pickup_enabled,delivery_enabled,delivery_price,logo_url,cover_url,verified")
        .eq("slug", slug).eq("active", true).maybeSingle();
      business = previous.data ? { ...previous.data, instagram_url: null, facebook_url: null } : null;
      error = previous.error;
    }
    // Keep the first-stage public store readable until the manual migration runs.
    if (error && ["42703", "PGRST204"].includes(error.code)) {
      const legacy = await client.from("businesses")
        .select("id,slug,name,description,city,latitude,longitude,whatsapp,pickup_enabled,delivery_enabled,delivery_price,verified")
        .eq("slug", slug).eq("active", true).maybeSingle();
      business = legacy.data ? { ...legacy.data, logo_url: null, cover_url: null, instagram_url: null, facebook_url: null } : null;
      error = legacy.error;
    }
    if (error) throw error;
    if (!business) return { store: null, error: false };

    const [products, relations, hours] = await Promise.all([
      getPublicStoreProducts(client, business.id),
      client.from("business_categories").select("category:categories!inner(id,name,slug)").eq("business_id", business.id),
      readBusinessHours(client,business.id).catch(() => null),
    ]);
    if (relations.error) throw relations.error;
    const categories = new Map<string, PublicStore["categories"][number]>();
    for (const relation of relations.data ?? []) categories.set(relation.category.id, relation.category);
    for (const product of products) {
      const category = product.database?.category;
      if (category) categories.set(category.id, category);
    }
    return { store: { business, products, hours, categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, "es")) }, error: false };
  } catch {
    // A failed query must not look like an empty or missing store.
    return { store: null, error: true };
  }
});

import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProduct } from "@/lib/public-catalog";

// Per-request deduplication for metadata/page, never a cross-request product cache.
export const loadPublicProduct = cache(async (id: string) => {
  try {
    const client = await createSupabaseServerClient();
    if (!client) throw new Error("unavailable");
    return { product: await getPublicProduct(client, id), error: false };
  } catch { return { product: null, error: true }; }
});

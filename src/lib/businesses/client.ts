"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function getOwnedBusiness(client: SupabaseClient<Database>, userId: string) {
  const { data, error } = await client.from("businesses").select("*").eq("owner_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}
export async function getBusinessFormData(client: SupabaseClient<Database>, businessId?: string) {
  const [categories, relations] = await Promise.all([
    client.from("categories").select("*").order("name"),
    businessId ? client.from("business_categories").select("category_id").eq("business_id", businessId) : Promise.resolve({ data: [], error: null }),
  ]);
  if (categories.error) throw categories.error;
  if (relations.error) throw relations.error;
  return { categories: categories.data, categoryIds: relations.data.map(item => item.category_id) };
}

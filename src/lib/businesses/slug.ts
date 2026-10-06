import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function normalizeStoreSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

export function storeSlugValidation(slug: string) {
  if (slug.length < 3 || slug.length > 50) return "Usá entre 3 y 50 caracteres para la dirección.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "Usá letras, números y guiones, sin guiones al inicio o al final.";
  return "";
}

export async function checkStoreSlug(client: SupabaseClient<Database>, businessId: string, slug: string) {
  const { data, error } = await client.rpc("is_my_business_slug_available", { p_business_id: businessId, p_slug: slug });
  if (error) throw error;
  return data === true;
}

export function changeStoreSlug(client: SupabaseClient<Database>, businessId: string, slug: string) {
  return client.rpc("change_my_business_slug", { p_business_id: businessId, p_slug: slug });
}

export function storeSlugError(error: { code?: string; message?: string }) {
  if (error.message?.includes("BUSINESS_SLUG_TAKEN") || error.code === "23505") return "Esta dirección ya está en uso.";
  if (error.message?.includes("BUSINESS_SLUG_INVALID")) return "Usá una dirección válida de entre 3 y 50 caracteres.";
  if (error.code === "42501") return "No pudimos cambiar la dirección. Ingresá con la cuenta dueña del comercio.";
  return "No pudimos cambiar la dirección. Volvé a intentar; comprobá tu enlace actual si perdiste la conexión.";
}

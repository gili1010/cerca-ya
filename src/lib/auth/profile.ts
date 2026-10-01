import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, ProfileRow } from "@/types/database";

export async function ensureProfile(client: SupabaseClient<Database>, user: User): Promise<ProfileRow> {
  const existing = await client.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;
  const metadata = user.user_metadata;
  const full_name = typeof metadata.full_name === "string" ? metadata.full_name.trim().slice(0, 160) : "";
  const phone = typeof metadata.phone === "string" ? metadata.phone.trim().slice(0, 40) || null : null;
  const created = await client.from("profiles").insert({ id: user.id, full_name, phone }).select("*").single();
  if (!created.error) return created.data;
  // The signup trigger or another tab may have inserted it concurrently.
  if (created.error.code === "23505") {
    const restored = await client.from("profiles").select("*").eq("id", user.id).single();
    if (!restored.error) return restored.data;
  }
  throw created.error;
}

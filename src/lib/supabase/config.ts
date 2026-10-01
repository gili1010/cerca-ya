// Only public project configuration. Never read service-role/secret keys here.
export function getSupabaseConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (key.startsWith("sb_secret_")) throw new Error("Supabase requiere una clave pública publishable o anon, nunca una clave secret.");
  return { url, key };
}

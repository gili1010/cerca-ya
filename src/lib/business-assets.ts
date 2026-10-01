import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { PreparedPhoto } from "./merchant-products/compress-photo";
import { getSupabaseConfig } from "./supabase/config";

export type StoreAssetKind = "logo" | "cover";
export type StoreAssetChange = { kind: "keep" } | { kind: "remove" } | { kind: "upload"; photo: PreparedPhoto };
export interface StoreBranding { description: string; logo_url: string | null; cover_url: string | null }
type Client = SupabaseClient<Database>;
const bucket = "business-assets";

export function storeAssetPath(url: string | null | undefined, businessId: string, kind: StoreAssetKind): string | null {
  if (!url) return null;
  try {
    const config = getSupabaseConfig();
    if (!config) return null;
    const base = new URL(`${config.url.replace(/\/$/, "")}/storage/v1/object/public/${bucket}/${businessId}/${kind}/`);
    const parsed = new URL(url);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname) || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    const filename = parsed.pathname.slice(base.pathname.length);
    return /^[0-9a-f-]{36}\.(webp|jpg)$/.test(filename) ? `${businessId}/${kind}/${filename}` : null;
  } catch { return null; }
}

export async function readStoreBranding(client: Client, businessId: string): Promise<StoreBranding> {
  const { data, error } = await client.from("businesses").select("description,logo_url,cover_url").eq("id", businessId).single();
  if (error) throw error;
  return data;
}

export async function cleanupStoreAssets(client: Client, businessId: string, paths: string[]): Promise<string[]> {
  const pending: string[] = [];
  for (const path of [...new Set(paths)]) {
    const parts = path.split("/");
    if (parts.length !== 3 || parts[0] !== businessId || !["logo", "cover"].includes(parts[1]) || !/^[0-9a-f-]{36}\.(webp|jpg)$/.test(parts[2])) continue;
    try {
      const current = await readStoreBranding(client, businessId);
      if (storeAssetPath(current.logo_url, businessId, "logo") === path || storeAssetPath(current.cover_url, businessId, "cover") === path) continue;
      const removed = await client.storage.from(bucket).remove([path]);
      if (removed.error) throw removed.error;
      if (!removed.data?.length) {
        const listed = await client.storage.from(bucket).list(`${businessId}/${parts[1]}`, { search: parts[2], limit: 100 });
        if (listed.error || listed.data?.some(item => item.name === parts[2])) throw new Error("cleanup_pending");
      }
    } catch { pending.push(path); }
  }
  return pending;
}

export async function saveStoreBranding(client: Client, businessId: string, previous: StoreBranding, description: string, changes: Record<StoreAssetKind, StoreAssetChange>) {
  const desired: StoreBranding = { ...previous, description: description.trim() };
  const uploaded: string[] = [];
  let current: StoreBranding | null = previous;
  let success = false;
  let attemptedSave = false;
  let message = "No pudimos guardar tu tienda. Revisá la conexión y volvé a intentar.";
  try {
    for (const kind of ["logo", "cover"] as const) {
      const change = changes[kind];
      if (change.kind === "remove") desired[`${kind}_url`] = null;
      if (change.kind === "upload") {
        const path = `${businessId}/${kind}/${crypto.randomUUID()}.${change.photo.extension}`;
        // Track before uploading: a lost response may still leave uploaded bytes.
        uploaded.push(path);
        const result = await client.storage.from(bucket).upload(path, change.photo.blob, { contentType: change.photo.blob.type, upsert: false, cacheControl: "3600" });
        if (result.error) throw result.error;
        desired[`${kind}_url`] = client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      }
    }
    attemptedSave = true;
    const result = await client.rpc("save_my_store_branding", {
      p_description: desired.description, p_logo_url: desired.logo_url, p_cover_url: desired.cover_url,
      p_expected_description: previous.description, p_expected_logo_url: previous.logo_url, p_expected_cover_url: previous.cover_url,
    });
    if (result.error) {
      if (result.error.code === "40001") message = "Tu tienda cambió en otra sesión. Recargá los datos antes de volver a guardar.";
      if (["PGRST202", "42883"].includes(result.error.code)) message = "Falta habilitar la personalización. Ejecutá business-store-branding.sql en Supabase.";
      throw result.error;
    }
    current = desired;
    success = true;
  } catch {
    if (attemptedSave) {
      // Never assume a failed network response means the transaction rolled back.
      try {
        current = await readStoreBranding(client, businessId);
        success = current.description === desired.description && current.logo_url === desired.logo_url && current.cover_url === desired.cover_url;
      } catch {
        current = null;
        message = "No pudimos comprobar si se guardó tu tienda. Recargá los datos antes de intentar nuevamente.";
      }
    }
  }
  const oldPaths = (["logo", "cover"] as const).flatMap(kind => {
    const path = storeAssetPath(previous[`${kind}_url`], businessId, kind);
    return path ? [path] : [];
  });
  // Both client reference checks and Storage RLS protect currently used assets.
  const pendingCleanup = await cleanupStoreAssets(client, businessId, [...uploaded, ...oldPaths]);
  return { success, current, pendingCleanup, message: success ? "" : message };
}

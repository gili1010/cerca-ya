"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ProductImageRow } from "@/types/database";
import type { PreparedPhoto } from "./compress-photo";

const bucket = "product-images";
type Client = SupabaseClient<Database>;
export type MainPhoto = Pick<ProductImageRow, "url">;
export type PhotoChange = { kind: "keep" } | { kind: "remove" } | { kind: "upload"; photo: PreparedPhoto };

function ownedPath(client: Client, businessId: string, productId: string, url: string | null) {
  if (!url) return null;
  const folder = `${businessId}/${productId}/`;
  const prefix = client.storage.from(bucket).getPublicUrl(folder).data.publicUrl;
  try {
    const parsed = new URL(url); const base = new URL(prefix);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith(base.pathname)) return null;
    const filename = parsed.pathname.slice(base.pathname.length);
    return /^[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$/.test(filename) ? folder + filename : null;
  } catch { return null; }
}

// Retryable compensation, scoped to this product and only files no longer referenced.
export async function cleanupProductPhotos(client: Client, businessId: string, productId: string, paths: string[]) {
  const pending: string[] = [];
  for (const path of [...new Set(paths)]) {
    if (!path.startsWith(`${businessId}/${productId}/`) || !/^[0-9a-f-]{36}\.(webp|jpg|jpeg|png)$/.test(path.split("/")[2] ?? "") || path.split("/").length !== 3) continue;
    try {
      const references = await client.from("product_images").select("url").eq("product_id", productId);
      if (references.error) throw references.error;
      if (references.data.some(item => ownedPath(client, businessId, productId, item.url) === path)) continue;
      const removed = await client.storage.from(bucket).remove([path]);
      if (removed.error) throw removed.error;
      // DELETE under RLS may return no rows. Distinguish absent from denied/present.
      if (!removed.data?.length) {
        const filename = path.split("/")[2];
        const listed = await client.storage.from(bucket).list(`${businessId}/${productId}`, { search: filename, limit: 100 });
        if (listed.error || listed.data?.some(item => item.name === filename)) throw new Error("cleanup_pending");
      }
    } catch { pending.push(path); }
  }
  return pending;
}

export async function saveProductPhoto(client: Client, businessId: string, productId: string, previousUrl: string | null, change: Exclude<PhotoChange, { kind: "keep" }>) {
  let uploadedPath: string | null = null;
  let desiredUrl: string | null = null;
  let currentUrl = previousUrl;
  let committed = false;
  let canReconcile = false;
  let failureMessage = "No pudimos subir la imagen.";
  try {
    if (change.kind === "upload") {
      uploadedPath = `${businessId}/${productId}/${crypto.randomUUID()}.${change.photo.extension}`;
      desiredUrl = client.storage.from(bucket).getPublicUrl(uploadedPath).data.publicUrl;
      const uploaded = await client.storage.from(bucket).upload(uploadedPath, change.photo.blob, {
        contentType: change.photo.blob.type, upsert: false, cacheControl: "3600",
      });
      if (uploaded.error) throw uploaded.error;
    }
    canReconcile = true;
    const result = await client.rpc("set_my_product_photo", { p_product_id: productId, p_url: desiredUrl, p_expected_url: previousUrl });
    if (result.error) {
      if (result.error.code === "40001") failureMessage = "La foto cambió en otra sesión. Revisá la foto actual antes de volver a guardar.";
      if (result.error.code === "PGRST202" || result.error.code === "42883") failureMessage = "No pudimos guardar la foto en este momento. Volvé a intentar más tarde.";
      throw result.error;
    }
    committed = true; currentUrl = desiredUrl;
  } catch {
    if (canReconcile) {
      // A lost response is not proof of rollback. Re-read before deleting uploaded bytes.
      try {
        const current = await client.from("product_images").select("url").eq("product_id", productId).eq("position", 0).maybeSingle();
        if (current.error) throw current.error;
        currentUrl = current.data?.url ?? null;
        committed = currentUrl === desiredUrl;
      } catch { failureMessage = "No pudimos comprobar si se guardó la foto. Volvé a Editar antes de intentar nuevamente."; }
    }
  }
  const oldPath = ownedPath(client, businessId, productId, previousUrl);
  // Reference checks make this safe even after an uncertain response or a competing edit.
  const candidates = [...(oldPath ? [oldPath] : []), ...(!committed && uploadedPath ? [uploadedPath] : [])];
  const pendingCleanup = await cleanupProductPhotos(client, businessId, productId, candidates);
  return { success: committed, url: currentUrl, pendingCleanup,
    message: committed ? "" : change.kind === "remove" && failureMessage === "No pudimos subir la imagen." ? "No pudimos eliminar la foto." : failureMessage };
}

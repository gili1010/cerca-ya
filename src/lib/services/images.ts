"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OwnedServiceListing, OwnedServiceProvider } from "@/types/services";
import { compressPhoto, type PreparedPhoto } from "@/lib/merchant-products/compress-photo";
import { readMyServiceListing, readMyServiceProvider } from "./client";
import { serviceBucket, serviceSignedUrlSeconds, isServicePath, requireServiceId, requireServiceRevision, serviceError } from "./contracts";

type Client = SupabaseClient<Database>;
type Kind = "providers" | "listings";
export class ServiceUploadError extends Error {
  constructor(public readonly objectPath: string) {
    super("No pudimos confirmar la subida. Conservá esta ruta y volvé a cargar antes de reintentar.");
    this.name = "ServiceUploadError";
  }
}
export async function prepareServicePhoto(file: File): Promise<PreparedPhoto> { return compressPhoto(file); }
export async function uploadServicePhoto(client: Client, kind: Kind, id: string, photo: PreparedPhoto): Promise<string> {
  requireServiceId(id);
  if (photo.blob.size === 0 || photo.blob.size > 2 * 1024 * 1024 || photo.blob.type !== (photo.extension === "webp" ? "image/webp" : "image/jpeg")) throw new Error("Revisá la imagen antes de subirla.");
  const path = `${kind}/${id.toLowerCase()}/${crypto.randomUUID()}.${photo.extension}`;
  try {
    const { error } = await client.storage.from(serviceBucket).upload(path, photo.blob, { upsert: false, contentType: photo.blob.type, cacheControl: "600" });
    if (error) throw error;
  } catch { throw new ServiceUploadError(path); }
  return path;
}
async function references(client: Client, kind: Kind, id: string): Promise<string[] | null> {
  if (kind === "providers") {
    const provider = await readMyServiceProvider(client);
    return provider?.id === id ? provider.avatar_path ? [provider.avatar_path] : [] : null;
  }
  const listing = await readMyServiceListing(client, id);
  return listing ? listing.images.map(image => image.object_path) : null;
}
/** Sólo archivos no vinculados. RLS revalida bajo el mismo bloqueo que la RPC. */
export async function cleanupServicePhotos(client: Client, kind: Kind, id: string, paths: string[]): Promise<string[]> {
  requireServiceId(id);
  const selected = [...new Set(paths)];
  if (selected.length > (kind === "providers" ? 2 : 10) || selected.some(path => !isServicePath(path, kind, id))) throw new Error("Revisá las rutas de las fotos.");
  if (!selected.length) return [];
  const current = await references(client, kind, id); if (!current) return selected;
  const linked = new Set(current), pending: string[] = [];
  for (const path of selected) {
    if (linked.has(path)) continue;
    try {
      const { data, error } = await client.storage.from(serviceBucket).remove([path]);
      if (error) throw error;
      if (!data?.length) {
        const name = path.split("/")[2];
        const result = await client.storage.from(serviceBucket).list(`${kind}/${id.toLowerCase()}`, { search: name, limit: 10 });
        if (result.error || result.data?.some(file => file.name === name)) throw new Error("pending");
      }
    } catch { pending.push(path); }
  }
  return pending;
}
/** Recuperación de temporales tras recargar; la carpeta es acotada por la policy. */
export async function readUnattachedServicePhotos(client: Client, kind: Kind, id: string) {
  requireServiceId(id);
  const linked = await references(client, kind, id); if (!linked) throw new Error("No pudimos recuperar las fotos.");
  const { data, error } = await client.storage.from(serviceBucket).list(`${kind}/${id.toLowerCase()}`, { limit: 10 });
  if (error) throw new Error("No pudimos recuperar las fotos.");
  return (data ?? []).map(file => `${kind}/${id.toLowerCase()}/${file.name}`).filter(path => isServicePath(path, kind, id) && !linked.includes(path));
}
export interface ServicePhotoSaveResult<T> {
  success: boolean; uncertain: boolean; current: T | null; pendingCleanup: string[]; message: string;
}
async function commitPhotos<T extends { revision: number }>(
  client: Client, kind: Kind, id: string, revision: number, previousPaths: string[], desiredPaths: string[],
  request: PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>,
  read: () => Promise<T | null>, pathsOf: (current: T) => string[],
): Promise<ServicePhotoSaveResult<T>> {
  let serverConfirmed = false, reconcile = true, current: T | null = null, message = "";
  try {
    const { data, error } = await request;
    if (error) { reconcile = !error.code || error.code === "40003" || error.code === "08007"; message = serviceError(error); }
    else if (data === id) serverConfirmed = true;
    else message = "No pudimos confirmar el guardado.";
  } catch { message = "No pudimos confirmar el guardado."; }
  try { current = await read(); } catch { /* Una respuesta incierta no habilita borrados compensatorios. */ }
  const matching = current !== null && current.revision === revision + 1 && pathsOf(current).length === desiredPaths.length && pathsOf(current).every((path, index) => path === desiredPaths[index]);
  const success = matching && (serverConfirmed || reconcile);
  const unchanged = current !== null && current.revision === revision;
  const uncertain = !current || (!success && (serverConfirmed || (!unchanged && reconcile)));
  // Si hay un conflicto, no borrar imágenes que otra revisión pudo referenciar.
  const candidates = uncertain ? [] : success ? previousPaths.filter(path => !desiredPaths.includes(path)) : desiredPaths.filter(path => !previousPaths.includes(path));
  let pendingCleanup = candidates;
  try { pendingCleanup = await cleanupServicePhotos(client, kind, id, candidates); } catch { /* Recuperar manualmente tras recargar. */ }
  if (uncertain) message = "Volvé a cargar y revisá las fotos antes de reintentar; no pudimos confirmar esta revisión.";
  return { success, uncertain, current, pendingCleanup, message: success ? "" : message || "La publicación cambió. Volvé a cargarla." };
}
export async function saveServiceListingPhotos(client: Client, previous: OwnedServiceListing, paths: string[]) {
  requireServiceId(previous.id); requireServiceRevision(previous.revision);
  if (paths.length > 5 || new Set(paths).size !== paths.length || paths.some(path => !isServicePath(path, "listings", previous.id))) throw new Error("Revisá las fotos del servicio.");
  return commitPhotos(client, "listings", previous.id, previous.revision, previous.images.map(image => image.object_path), paths,
    client.rpc("set_my_service_listing_images", { p_listing_id: previous.id, p_paths: paths, p_expected_revision: previous.revision }),
    () => readMyServiceListing(client, previous.id), current => current.images.map(image => image.object_path));
}
export async function saveServiceProviderPhoto(client: Client, previous: OwnedServiceProvider, path: string | null) {
  requireServiceId(previous.id); requireServiceRevision(previous.revision);
  if (path !== null && !isServicePath(path, "providers", previous.id)) throw new Error("Revisá la foto del prestador.");
  return commitPhotos(client, "providers", previous.id, previous.revision, previous.avatar_path ? [previous.avatar_path] : [], path ? [path] : [],
    client.rpc("set_my_service_provider_avatar", { p_provider_id: previous.id, p_path: path, p_expected_revision: previous.revision }),
    async () => { const provider = await readMyServiceProvider(client); return provider?.id === previous.id ? provider : null; }, current => current.avatar_path ? [current.avatar_path] : []);
}
/** Firma bajo políticas públicas/propias. Nunca persistir estos enlaces. */
export async function signServicePhotos(client: Client, paths: string[]) {
  const selected = [...new Set(paths)];
  if (selected.length > 250 || selected.some(path => !isServicePath(path))) throw new Error("Revisá las fotos que querés cargar.");
  const urls: Record<string, string> = {};
  if (!selected.length) return { urls, unavailable: [] as string[], expiresAt: Date.now() };
  const issuedAt = Date.now();
  const { data, error } = await client.storage.from(serviceBucket).createSignedUrls(selected, serviceSignedUrlSeconds);
  if (error) throw new Error("No pudimos cargar las fotos. Volvé a intentar.");
  const unavailable: string[] = [];
  for (const path of selected) {
    const signed = data?.find(item => item.path === path);
    if (!signed?.signedUrl || signed.error) unavailable.push(path); else urls[path] = signed.signedUrl;
  }
  return { urls, unavailable, expiresAt: issuedAt + serviceSignedUrlSeconds * 1000 };
}


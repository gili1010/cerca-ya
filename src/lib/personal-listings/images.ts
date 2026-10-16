"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { OwnedPersonalListing } from "@/types/personal-listings";
import { compressPhoto, type PreparedPhoto } from "@/lib/merchant-products/compress-photo";
import { readMyPersonalListing } from "./client";
import {
  isPersonalListingObjectPath, personalListingBucket, personalListingError, personalListingSignedUrlSeconds,
  requireListingId, requireRevision,
} from "./contracts";

type Client = SupabaseClient<Database>;

export class PersonalListingUploadError extends Error {
  constructor(public readonly objectPath: string) {
    super("No pudimos confirmar la subida. Volvé a cargar las fotos antes de reintentar.");
    this.name = "PersonalListingUploadError";
  }
}

export async function preparePersonalListingPhoto(file: File): Promise<PreparedPhoto> {
  return compressPhoto(file);
}

/** Sube una versión privada; todavía no la incluye en la publicación. */
export async function uploadPersonalListingPhoto(client: Client, listingId: string, photo: PreparedPhoto): Promise<string> {
  requireListingId(listingId);
  if (photo.blob.size > 2 * 1024 * 1024 || photo.blob.size === 0
    || photo.blob.type !== (photo.extension === "webp" ? "image/webp" : "image/jpeg")) {
    throw new Error("No pudimos preparar la imagen. Seleccioná otra foto.");
  }
  const path = `${listingId.toLowerCase()}/${crypto.randomUUID()}.${photo.extension}`;
  try {
    const { error } = await client.storage.from(personalListingBucket).upload(path, photo.blob, {
      contentType: photo.blob.type, upsert: false, cacheControl: "600",
    });
    if (error) throw error;
  } catch {
    // Conservar la ruta permite reconciliar/limpiar una subida de resultado incierto.
    throw new PersonalListingUploadError(path);
  }
  return path;
}

/** Bytes por Storage API, nunca DELETE SQL sobre storage.objects. La policy
 * vuelve a comprobar propiedad/referencias bajo bloqueo, incluso si hay una carrera. */
export async function cleanupPersonalListingPhotos(client: Client, listingId: string, paths: string[]): Promise<string[]> {
  requireListingId(listingId);
  const candidates = [...new Set(paths)].filter(path => isPersonalListingObjectPath(path, listingId));
  if (candidates.length > 10) throw new Error("Revisá las fotos antes de intentar eliminarlas.");
  if (!candidates.length) return [];
  const listing = await readMyPersonalListing(client, listingId);
  if (!listing) return candidates;
  const references = new Set(listing.images.map(image => image.object_path));
  const pending: string[] = [];
  for (const path of candidates) {
    if (references.has(path)) continue;
    try {
      const result = await client.storage.from(personalListingBucket).remove([path]);
      if (result.error) throw result.error;
      if (!result.data?.length) {
        // RLS puede devolver cero filas tanto si no existe como si deniega DELETE.
        const name = path.split("/")[1];
        const remaining = await client.storage.from(personalListingBucket).list(listingId.toLowerCase(), { search: name, limit: 10 });
        if (remaining.error || remaining.data?.some(image => image.name === name)) throw new Error("cleanup_pending");
      }
    } catch { pending.push(path); }
  }
  return pending;
}

export interface PersonalListingImageSaveResult {
  success: boolean; uncertain: boolean; listing: OwnedPersonalListing | null;
  pendingCleanup: string[]; message: string;
}

/** Orden=posición; primera foto=principal. Retira referencias atómicamente y
 * sólo después limpia los bytes. Reconsulta antes de compensar una respuesta perdida. */
export async function savePersonalListingImages(
  client: Client, previous: OwnedPersonalListing, desiredPaths: string[],
): Promise<PersonalListingImageSaveResult> {
  requireListingId(previous.id); requireRevision(previous.revision);
  if (desiredPaths.length > 5 || new Set(desiredPaths).size !== desiredPaths.length
    || desiredPaths.some(path => !isPersonalListingObjectPath(path, previous.id))) {
    throw new Error("Elegí hasta cinco fotos de esta publicación.");
  }
  const previousPaths = previous.images.map(image => image.object_path);
  let committed = false; let uncertain = false; let reconcile = true; let listing: OwnedPersonalListing | null = null;
  let message = "";
  try {
    const { error } = await client.rpc("set_my_personal_listing_images", {
      p_listing_id: previous.id, p_paths: desiredPaths, p_expected_revision: previous.revision,
    });
    if (error) {
      // Un rechazo SQL explícito no se transforma en éxito aunque las fotos
      // existentes coincidan (por ejemplo, un anuncio bloqueado).
      reconcile = !error.code || error.code === "40003" || error.code === "08007";
      message = personalListingError(error);
      throw new Error(message);
    }
    committed = true;
  } catch {
    message ||= "No pudimos guardar las fotos. Volvé a cargar la publicación.";
  }
  try {
    listing = await readMyPersonalListing(client, previous.id);
    if (!listing) throw new Error("unavailable");
    if (!committed && reconcile) {
      const actual = listing.images.map(image => image.object_path);
      committed = actual.length === desiredPaths.length && actual.every((path, index) => path === desiredPaths[index]);
    }
  } catch {
    // No borrar versiones nuevas si no se conoce el resultado de la operación.
    uncertain = true;
    message = "No pudimos comprobar el estado de las fotos. Volvé a cargar la publicación antes de reintentar.";
  }
  const cleanup = uncertain ? [] : committed
    ? previousPaths.filter(path => !desiredPaths.includes(path))
    : desiredPaths.filter(path => !previousPaths.includes(path));
  let pendingCleanup: string[] = [];
  try { pendingCleanup = await cleanupPersonalListingPhotos(client, previous.id, cleanup); }
  catch { pendingCleanup = cleanup; }
  return { success: committed && !uncertain, uncertain, listing, pendingCleanup, message: committed && !uncertain ? "" : message };
}

/** Funciona también para visitantes: Storage autoriza solamente fotos vinculadas
 * a anuncios públicos. No requiere secret key, bucket público ni API externa. */
export async function signPersonalListingImages(client: Client, paths: string[]) {
  const unique = [...new Set(paths)];
  if (unique.length > 250 || unique.some(path => !isPersonalListingObjectPath(path))) {
    throw new Error("No pudimos cargar las imágenes.");
  }
  const urls: Record<string, string> = {};
  if (!unique.length) return { urls, unavailable: [] as string[], expiresAt: Date.now() };
  const issuedAt = Date.now();
  const { data, error } = await client.storage.from(personalListingBucket).createSignedUrls(unique, personalListingSignedUrlSeconds);
  if (error) throw new Error("No pudimos cargar las imágenes. Volvé a intentar.");
  const unavailable: string[] = [];
  for (const path of unique) {
    const signed = data?.find(item => item.path === path);
    if (!signed?.signedUrl || signed.error) unavailable.push(path);
    else urls[path] = signed.signedUrl;
  }
  // No persistir URLs firmadas en tablas ni localStorage. Renovar al vencer.
  return { urls, unavailable, expiresAt: issuedAt + personalListingSignedUrlSeconds * 1000 };
}

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import type { PersonalListingPageOptions, OwnedPersonalListingPageOptions } from "@/types/personal-listings";
import { readMyPersonalListings, readPersonalListings, readPublicPersonalListing } from "./client";

// Cliente SSR con la sesión del solicitante; sin cliente privilegiado ni cache
// compartida entre cuentas que pudiera conservar borradores/contactos retirados.
export async function getPublicPersonalListing(id: string) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("No pudimos cargar la publicación.");
  return readPublicPersonalListing(client, id);
}
export async function getPersonalListingsPage(options: PersonalListingPageOptions) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("No pudimos cargar las publicaciones.");
  return readPersonalListings(client, options);
}
export async function getMyPersonalListingsPage(options: OwnedPersonalListingPageOptions = {}) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Iniciá sesión para consultar tus publicaciones.");
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("No pudimos cargar tus publicaciones.");
  return readMyPersonalListings(client, options);
}

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedUser } from "@/lib/auth/server";
import type { ServiceSearchOptions, MyServiceOptions } from "@/types/services";
import { readServiceCategories, readServiceListings, readServiceProviders, readPublicServiceListing, readPublicServiceProvider, readMyServiceListings, readMyServiceProvider } from "./client";

async function requestClient(own = false) {
  if (own && !await getAuthenticatedUser()) throw new Error("Iniciá sesión para consultar tus servicios.");
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("No pudimos cargar los servicios.");
  return client;
}
// SSR con cookies del solicitante, sin secret key ni cache compartida entre cuentas.
export async function getServiceCategories() { return readServiceCategories(await requestClient()); }
export async function getServiceListingsPage(options: ServiceSearchOptions) { return readServiceListings(await requestClient(), options); }
export async function getServiceProvidersPage(options: Omit<ServiceSearchOptions, "providerId">) { return readServiceProviders(await requestClient(), options); }
export async function getPublicServiceListing(id: string) { return readPublicServiceListing(await requestClient(), id); }
export async function getPublicServiceProvider(id: string) { return readPublicServiceProvider(await requestClient(), id); }
export async function getMyServiceProvider() { return readMyServiceProvider(await requestClient(true)); }
export async function getMyServiceListingsPage(options: MyServiceOptions = {}) { return readMyServiceListings(await requestClient(true), options); }

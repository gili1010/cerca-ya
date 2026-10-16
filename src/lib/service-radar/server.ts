import "server-only";
import { getAuthenticatedUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ServiceRadarOptions, ServiceRadarOfferOptions } from "@/types/service-radar";
import { readMyServiceRequests, readServiceRadar, readServiceRequestOffers } from "./client";

async function requestClient() {
 if (!await getAuthenticatedUser()) throw new Error("Iniciá sesión para continuar.");
 const client = await createSupabaseServerClient();
 if (!client) throw new Error("No pudimos cargar el Radar de servicios.");
 return client;
}
// Cookies SSR del solicitante. Sin secret keys ni cache compartida entre usuarios.
export async function getMyServiceRequests(options: Omit<ServiceRadarOptions, "categoryId"> = {}) { return readMyServiceRequests(await requestClient(), options); }
export async function getMyServiceRequest(id: string) { return (await getMyServiceRequests({ requestId: id, pageSize: 1 })).items[0] ?? null; }
export async function getServiceRadar(options: ServiceRadarOptions = {}) { return readServiceRadar(await requestClient(), options); }
export async function getServiceRadarOpportunity(id: string) { return (await getServiceRadar({ requestId: id, pageSize: 1 })).items[0] ?? null; }
export async function getServiceRequestOffers(options: ServiceRadarOfferOptions = {}) { return readServiceRequestOffers(await requestClient(), options); }
export async function getMyServiceRequestOffer(id: string, seller = false) { return (await getServiceRequestOffers({ offerId: id, seller, pageSize: 1 })).items[0] ?? null; }

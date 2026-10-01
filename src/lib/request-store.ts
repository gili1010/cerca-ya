"use client";

import { useSyncExternalStore } from "react";
import { createMockRequests } from "@/data/requests";
import { createMockOffers } from "@/data/offers";
import { seedRadarRequests } from "@/data/radar-requests";
import { businesses, DEMO_BUYER_ID } from "@/data/businesses";
import { addOffer, addRequest, changeRequestStatus, parseDatabase, reserveOffer } from "./request-domain";
import type { OfferInput, RequestDatabase, RequestInput } from "@/types/requests";
import { demoBuyer } from "@/data/buyer";
import { availableStock, cancelReservation, createReservation, expireReservations, manageReservation, type MerchantReservationAction } from "./reservation-domain";
import type { ReservationInput } from "@/types/reservations";
import { getPublicProduct } from "./public-catalog";
import { getSupabaseBrowserClient } from "./supabase/client";

export const REQUEST_STORAGE_KEY = "cercaya.pedidos.v1";
interface Snapshot { ready: boolean; database: RequestDatabase; storageWarning: string | null }
const initial: Snapshot = { ready: false, database: { version: 1, requests: [], offers: [] }, storageWarning: null };
let snapshot = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());

function load() {
  if (snapshot.ready) return;
  const now = new Date();
  let database: RequestDatabase = { version: 1, requests: createMockRequests(now), offers: createMockOffers(now) };
  let storageWarning: string | null = null;
  try {
    const raw = window.localStorage.getItem(REQUEST_STORAGE_KEY);
    if (raw !== null) {
      const restored = parseDatabase(raw);
      if (!restored) { database = { version: 1, requests: [], offers: [] }; storageWarning = "Los datos guardados no se pudieron leer. No se reemplazarán automáticamente. Podés usar la demo durante esta sesión."; }
      else database = restored;
    } else window.localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(database));
    if (!storageWarning) {
      const seeded = seedRadarRequests(database, now);
      if (seeded !== database) {
        database = seeded;
        window.localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(database));
      }
    }
  } catch { storageWarning = "El navegador no permite guardar los datos. Los cambios durarán solo durante esta sesión."; }
  snapshot = { ready: true, database, storageWarning };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  currentDatabase();
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

function refresh() { currentDatabase(); }
function onVisibility() { if (document.visibilityState === "visible") refresh(); }
function onStorage(event: StorageEvent) { if (event.key === REQUEST_STORAGE_KEY || event.key === null) refresh(); }

function currentDatabase() {
  load();
  let database = snapshot.database;
  if (!snapshot.storageWarning) {
    try {
      const raw = window.localStorage.getItem(REQUEST_STORAGE_KEY);
      if (raw) {
        const latest = parseDatabase(raw);
        if (latest) database = latest;
        else { snapshot = { ...snapshot, storageWarning: "Los datos guardados cambiaron y no se pueden leer. Los cambios se conservarán solo en esta sesión." }; emit(); }
      } else database = { version: 1, requests: [], offers: [] };
    } catch { /* Keep the in-memory version when storage becomes unavailable. */ }
  }
  const expired = expireReservations(database, new Date().toISOString());
  if (expired !== database) commit(expired);
  else if (JSON.stringify(database) !== JSON.stringify(snapshot.database)) {
    snapshot = { ...snapshot, database };
    emit();
  }
  return expired;
}

function commit(database: RequestDatabase) {
  let storageWarning = snapshot.storageWarning;
  if (!storageWarning) {
    try { window.localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(database)); }
    catch { storageWarning = "No se pudo guardar en este navegador. Los cambios durarán solo durante esta sesión."; }
  }
  snapshot = { ready: true, database, storageWarning };
  emit();
}

export const requestActions = {
  create(input: RequestInput) {
    const result = addRequest(currentDatabase(), input, DEMO_BUYER_ID, new Date().toISOString());
    commit(result.database);
    return result.request;
  },
  async offer(requestId: string, businessId: string, input: OfferInput, sourceProductId?: string) {
    const business = businesses.find(item => item.id === businessId);
    if (!business) throw new Error("Elegí un comercio de prueba válido.");
    const send = () => {
      const result = addOffer(currentDatabase(), requestId, business, input, new Date().toISOString(), sourceProductId);
      commit(result.database);
      return result.offer;
    };
    if (navigator.locks) return navigator.locks.request(`${REQUEST_STORAGE_KEY}.offers`, send);
    return send();
  },
  close(id: string) { commit(changeRequestStatus(currentDatabase(), id, "CLOSED", DEMO_BUYER_ID)); },
  cancel(id: string) { commit(changeRequestStatus(currentDatabase(), id, "CANCELLED", DEMO_BUYER_ID)); },
  reserve(id: string) { commit(reserveOffer(currentDatabase(), id, DEMO_BUYER_ID)); },
};

export function useRequests() { return useSyncExternalStore(subscribe, () => snapshot, () => initial); }

// Reservation and inventory changes are persisted together in the existing store.
// A browser lock serializes competing confirmations from separate demo tabs.
async function reservationTransaction<T>(operation: (database: RequestDatabase) => T): Promise<T> {
  const run = () => operation(currentDatabase());
  if (navigator.locks) return navigator.locks.request(`${REQUEST_STORAGE_KEY}.reservations`, run);
  return run();
}

export const reservationActions = {
  async create(input: ReservationInput) {
    if (input.product?.source === "supabase") {
      // Re-read only the product, so a stale page cannot reserve an inactive listing.
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("No pudimos consultar la disponibilidad. Volvé a intentar.");
      let current: Awaited<ReturnType<typeof getPublicProduct>>;
      try { current = await getPublicProduct(client, input.productId); }
      catch { throw new Error("No pudimos consultar la disponibilidad. Volvé a intentar."); }
      if (!current) throw new Error("Producto no disponible.");
      if (current.price !== input.product.price || current.deliveryPrice !== input.product.deliveryPrice) throw new Error("El precio cambió. Recargá la página antes de reservar.");
      input = { ...input, product: current };
    }
    return reservationTransaction(database => {
      const result = createReservation(database, input, demoBuyer, new Date().toISOString());
      commit(result.database);
      return result.reservation;
    });
  },
  manage(id: string, businessId: string, action: MerchantReservationAction) {
    return reservationTransaction(database => commit(manageReservation(database, id, businessId, action, new Date().toISOString())));
  },
  cancel(id: string) {
    return reservationTransaction(database => commit(cancelReservation(database, id, demoBuyer.id)));
  },
};

export const useReservations = useRequests;
export function useProductStock(productId: string, remoteStock?: number) {
  const { ready, database } = useRequests();
  return { ready, stock: availableStock(database, productId, remoteStock) };
}

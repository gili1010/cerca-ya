import { neededWhenOptions, radiusOptions, requestCategories, type Business, type Offer, type OfferInput, type Request, type RequestDatabase, type RequestInput, type RequestStatus } from "../types/requests";
import { availableStock, parseReservationData } from "./reservation-domain";
import { approximateRequestDistance, canBusinessRespond } from "./request-availability";
import { products } from "./products";

export function validateRequest(input: RequestInput): string | null {
  if (input.title.trim().length < 3 || input.title.trim().length > 120) return "Escribí un título de entre 3 y 120 caracteres.";
  if (input.description.length > 1000) return "La descripción puede tener hasta 1000 caracteres.";
  if (!requestCategories.includes(input.category)) return "Elegí una categoría válida.";
  if (!neededWhenOptions.includes(input.neededWhen)) return "Elegí cuándo lo necesitás.";
  if (!radiusOptions.includes(input.radiusKm)) return "Elegí un radio válido.";
  return null;
}

export function validateOffer(input: OfferInput): string | null {
  if (input.productName.trim().length < 3 || input.productName.trim().length > 120) return "El producto ofrecido debe tener entre 3 y 120 caracteres.";
  if (!Number.isFinite(input.price) || input.price <= 0 || input.price > 100000000 || Math.abs(input.price * 100 - Math.round(input.price * 100)) > 0.0001) return "Ingresá un precio válido, mayor a cero y con hasta dos decimales.";
  if (input.description.trim().length < 3 || input.description.length > 1000) return "Ingresá una descripción de entre 3 y 1000 caracteres.";
  if (!input.pickupAvailable && !input.deliveryAvailable) return "Elegí retiro inmediato o entrega disponible.";
  if (input.deliveryAvailable && (!input.estimatedDelivery.trim() || input.estimatedDelivery.length > 120)) return "Indicá un tiempo estimado de entrega de hasta 120 caracteres.";
  return null;
}

function nextId(prefix: string, ids: string[]) {
  const max = ids.reduce((value, id) => Math.max(value, Number(id.replace(`${prefix}-`, "")) || 0), 1000);
  return `${prefix}-${max + 1}`;
}

export function addRequest(db: RequestDatabase, input: RequestInput, buyerId: string, now: string): { database: RequestDatabase; request: Request } {
  const error = validateRequest(input);
  if (error) throw new Error(error);
  const request: Request = { ...input, title: input.title.trim(), description: input.description.trim(), id: nextId("PED", db.requests.map(item => item.id)), buyerId, status: "OPEN", createdAt: now, offersCount: 0 };
  return { database: { ...db, requests: [request, ...db.requests] }, request };
}

export function addOffer(db: RequestDatabase, requestId: string, business: Business, input: OfferInput, now: string, sourceProductId?: string): { database: RequestDatabase; offer: Offer } {
  const request = db.requests.find(item => item.id === requestId);
  if (!request || !canBusinessRespond(request, business, Date.parse(now))) throw new Error("Este pedido está cerrado, vencido o fuera del radio de tu comercio.");
  if (db.offers.some(offer => offer.requestId === requestId && offer.businessId === business.id)) throw new Error("Ya enviaste una oferta para este pedido. Podés consultar tu oferta desde el Radar.");
  if (sourceProductId) {
    const product = products.find(item => item.id === sourceProductId && item.storeId === (business.catalogStoreId ?? business.id));
    if (!product) throw new Error("El producto sugerido no pertenece a tu catálogo.");
    if (availableStock(db, product.id) < 1) throw new Error("El producto sugerido ya no tiene stock disponible.");
    if (!product.pickupToday && !product.deliveryToday) throw new Error("El producto sugerido no tiene una modalidad disponible hoy.");
  }
  const error = validateOffer(input);
  if (error) throw new Error(error);
  const offer: Offer = { ...input, productName: input.productName.trim(), description: input.description.trim(), estimatedDelivery: input.deliveryAvailable ? input.estimatedDelivery.trim() : "", id: nextId("OFE", db.offers.map(item => item.id)), requestId, businessId: business.id, businessName: business.name, distanceKm: approximateRequestDistance(request, business), createdAt: now, stockAvailable: true, ...(sourceProductId ? { sourceProductId } : {}) };
  const offers = [...db.offers, offer];
  return { offer, database: { ...db, offers, requests: db.requests.map(item => item.id === requestId ? { ...item, offersCount: offers.filter(candidate => candidate.requestId === item.id).length } : item) } };
}

export function changeRequestStatus(db: RequestDatabase, id: string, status: Exclude<RequestStatus, "OPEN">, buyerId: string): RequestDatabase {
  const request = db.requests.find(item => item.id === id);
  if (!request || request.buyerId !== buyerId) throw new Error("No se encontró tu pedido.");
  if (request.status !== "OPEN") throw new Error("Este pedido ya está cerrado o cancelado.");
  return { ...db, requests: db.requests.map(item => item.id === id ? { ...item, status } : item) };
}

export function reserveOffer(db: RequestDatabase, id: string, buyerId: string): RequestDatabase {
  const offer = db.offers.find(item => item.id === id);
  if (!offer || !offer.stockAvailable) throw new Error("Esta oferta no tiene stock disponible.");
  const database = changeRequestStatus(db, offer.requestId, "CLOSED", buyerId);
  return { ...database, requests: database.requests.map(item => item.id === offer.requestId ? { ...item, reservedOfferId: id } : item) };
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const text = (value: unknown): value is string => typeof value === "string";
const validDate = (value: unknown) => text(value) && Number.isFinite(Date.parse(value));

// Validate persisted data before it can enter the UI. Counts are derived from offers.
export function parseDatabase(raw: string): RequestDatabase | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!record(value) || value.version !== 1 || !Array.isArray(value.requests) || !Array.isArray(value.offers)) return null;
    for (const r of value.requests) {
      if (!record(r) || !text(r.id) || !/^PED-\d+$/.test(r.id) || !text(r.buyerId) || !text(r.title) || !text(r.description) || !validDate(r.createdAt) || !["OPEN", "CLOSED", "CANCELLED"].includes(String(r.status)) || validateRequest(r as unknown as RequestInput)) return null;
      if (r.reservedOfferId !== undefined && (!text(r.reservedOfferId) || r.status !== "CLOSED")) return null;
      if (r.approximateDistanceKm !== undefined && (typeof r.approximateDistanceKm !== "number" || !Number.isFinite(r.approximateDistanceKm) || r.approximateDistanceKm < 0)) return null;
      if (r.expiresAt !== undefined && !validDate(r.expiresAt)) return null;
    }
    const requests = value.requests as Request[];
    const offers = value.offers as Offer[];
    for (const o of value.offers) {
      if (!record(o) || !text(o.id) || !/^OFE-\d+$/.test(o.id) || !text(o.requestId) || !text(o.businessId) || !text(o.businessName) || !text(o.productName) || !text(o.description) || !text(o.estimatedDelivery) || !validDate(o.createdAt) || typeof o.price !== "number" || typeof o.distanceKm !== "number" || !Number.isFinite(o.distanceKm) || o.distanceKm < 0 || typeof o.pickupAvailable !== "boolean" || typeof o.deliveryAvailable !== "boolean" || typeof o.alternative !== "boolean" || typeof o.stockAvailable !== "boolean" || validateOffer(o as unknown as OfferInput)) return null;
      const request = requests.find(r => r.id === o.requestId);
      if (!request || o.distanceKm > request.radiusKm) return null;
      if (o.sourceProductId !== undefined && !text(o.sourceProductId)) return null;
    }
    if (new Set(requests.map(r => r.id)).size !== requests.length || new Set(offers.map(o => o.id)).size !== offers.length) return null;
    if (requests.some(r => r.reservedOfferId && !offers.some(o => o.id === r.reservedOfferId && o.requestId === r.id))) return null;
    const reservationData = parseReservationData(value);
    if (!reservationData) return null;
    if (value.radarSeedVersion !== undefined && value.radarSeedVersion !== 1) return null;
    return { version: 1, offers, requests: requests.map(r => ({ ...r, offersCount: offers.filter(o => o.requestId === r.id).length })), ...reservationData, ...(value.radarSeedVersion === 1 ? { radarSeedVersion: 1 as const } : {}) };
  } catch { return null; }
}

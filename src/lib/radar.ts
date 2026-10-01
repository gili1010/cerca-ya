import { normalize } from "./catalog";
import { products, type Product } from "./products";
import { availableStock } from "./reservation-domain";
import { approximateRequestDistance, canBusinessRespond } from "./request-availability";
import type { Business, Offer, OfferInput, Request, RequestDatabase } from "../types/requests";

export type RadarFilter = "all" | "today" | "near5" | "near10" | "catalog";
export type RadarOrder = "recent" | "distance" | "urgent";
export interface RadarOpportunity {
  request: Pick<Request, "id" | "title" | "category" | "neededWhen" | "createdAt">;
  distanceKm: number;
  offersCount: number;
  categoryMatch: boolean;
  suggestedProduct?: Product;
  stock: number;
  sentOffer?: Offer;
  highlighted: boolean;
}

const ignoredTerms = new Set(["para", "con", "una", "uno", "del", "los", "las", "por", "busco", "necesito", "producto", "hoy"]);
function terms(text: string) {
  return [...new Set(normalize(text).split(/[^a-z0-9]+/).filter(term => term.length >= 3 && !ignoredTerms.has(term) && !/^\d+$/.test(term)).map(term => term.endsWith("s") && term.length > 4 ? term.slice(0, -1) : term))];
}
function categoryFamily(category: string) { return ["Electricidad", "Herramientas", "Pintura"].includes(category) ? "Ferretería" : category; }

export function businessCatalog(business: Business): Product[] {
  return products.filter(product => product.storeId === (business.catalogStoreId ?? business.id));
}

// Deterministic lexical matching; sharing a category alone is not a product match.
export function matchCatalog(request: Pick<Request, "title" | "category">, catalog: Product[], database: RequestDatabase): Product | undefined {
  const requested = terms(request.title);
  return catalog.map(product => {
    const nameTerms = terms(product.name);
    const overlaps = requested.filter(term => nameTerms.includes(term)).length;
    const score = overlaps === 0 ? 0 : overlaps * 10 + (categoryFamily(request.category) === categoryFamily(product.category) ? 2 : 0);
    return { product, score, inStock: availableStock(database, product.id) > 0 };
  }).filter(item => item.score > 0).sort((a, b) => Number(b.inStock) - Number(a.inStock) || b.score - a.score)[0]?.product;
}

export function urgency(neededWhen: Request["neededWhen"]): number {
  return ({ "Lo necesito hoy": 0, "Mañana": 1, "Esta semana": 2, "No tengo apuro": 3 })[neededWhen];
}
export function urgencyLabel(neededWhen: Request["neededWhen"]): string {
  return ({ "Lo necesito hoy": "⚡ Lo necesita hoy", "Mañana": "Lo necesita mañana", "Esta semana": "Esta semana", "No tengo apuro": "Sin apuro" })[neededWhen];
}

export function radarOpportunities(database: RequestDatabase, business: Business, now: number): RadarOpportunity[] {
  const catalog = businessCatalog(business);
  return database.requests.filter(request => canBusinessRespond(request, business, now)).map(request => {
    const offers = database.offers.filter(offer => offer.requestId === request.id);
    const distanceKm = approximateRequestDistance(request, business);
    const suggestedProduct = matchCatalog(request, catalog, database);
    return {
      // Only public request fields reach the Radar cards. Never expose buyer data or free-form descriptions.
      request: { id: request.id, title: request.title, category: request.category, neededWhen: request.neededWhen, createdAt: request.createdAt },
      distanceKm, offersCount: offers.length,
      categoryMatch: (business.businessCategories ?? []).includes(request.category), suggestedProduct,
      stock: suggestedProduct ? availableStock(database, suggestedProduct.id) : 0,
      sentOffer: offers.find(offer => offer.businessId === business.id),
      highlighted: distanceKm < 5 && urgency(request.neededWhen) === 0 && offers.length <= 1,
    };
  });
}

export function filterRadar(opportunities: RadarOpportunity[], filter: RadarFilter, order: RadarOrder) {
  return opportunities.filter(item => filter === "all" || (filter === "today" && urgency(item.request.neededWhen) === 0) || (filter === "near5" && item.distanceKm < 5) || (filter === "near10" && item.distanceKm < 10) || (filter === "catalog" && Boolean(item.suggestedProduct)))
    .sort((a, b) => {
      // Urgent ordering always puts today's needs first. Other orders prioritize merchant categories.
      if (order === "urgent") return urgency(a.request.neededWhen) - urgency(b.request.neededWhen) || Number(b.categoryMatch) - Number(a.categoryMatch) || a.distanceKm - b.distanceKm;
      const categoryPriority = Number(b.categoryMatch) - Number(a.categoryMatch);
      return categoryPriority || (order === "distance" ? a.distanceKm - b.distanceKm : Date.parse(b.request.createdAt) - Date.parse(a.request.createdAt));
    });
}

export function radarMetrics(items: RadarOpportunity[]) {
  return { total: items.length, today: items.filter(item => urgency(item.request.neededWhen) === 0).length, nearby: items.filter(item => item.distanceKm < 5).length, matching: items.filter(item => item.suggestedProduct).length };
}
export function localDemand(items: RadarOpportunity[]) {
  const counts = new Map<string, number>();
  items.forEach(item => counts.set(item.request.category, (counts.get(item.request.category) ?? 0) + 1));
  return [...counts].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
export function catalogOfferInput(product: Product): OfferInput {
  return { productName: product.name, price: product.price, description: product.description, pickupAvailable: product.pickupToday, deliveryAvailable: product.deliveryToday, estimatedDelivery: product.deliveryToday ? "Entrega hoy, a coordinar con el comercio" : "", alternative: false };
}

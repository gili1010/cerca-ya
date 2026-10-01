import { products } from "./products";
import { reservationStatuses, type Reservation, type ReservationBuyer, type ReservationData, type ReservationInput, type ReservationStatus } from "../types/reservations";
import type { RequestDatabase } from "../types/requests";
import { isProductUuid } from "./public-catalog";

export function availableStock(db: RequestDatabase, productId: string, remoteStock?: number): number {
  if (remoteStock !== undefined) return Math.min(remoteStock, db.inventory?.[productId] ?? remoteStock);
  return db.inventory?.[productId] ?? products.find(product => product.id === productId)?.stock ?? 0;
}

export function expireReservations(db: RequestDatabase, now: string): RequestDatabase {
  let changed = false;
  const reservations = db.reservations?.map(reservation => {
    if (reservation.status !== "PENDING" || Date.parse(reservation.expiresAt) >= Date.parse(now)) return reservation;
    changed = true;
    return { ...reservation, status: "EXPIRED" as const };
  });
  return changed ? { ...db, reservations } : db;
}

export function createReservation(db: RequestDatabase, input: ReservationInput, buyer: ReservationBuyer, now: string): { database: RequestDatabase; reservation: Reservation } {
  const product = input.product?.source === "supabase" ? input.product : products.find(item => item.id === input.productId);
  if (!product) throw new Error("Este producto ya no está disponible.");
  const real = product.source === "supabase";
  if (product.id !== input.productId || (real && (!isProductUuid(product.id) || !isProductUuid(product.storeId))) || !Number.isFinite(product.price) || product.price < 0 || !Number.isSafeInteger(product.stock) || product.stock < 0) throw new Error("No pudimos recuperar los datos del producto.");
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > availableStock(db, product.id, real ? product.stock : undefined)) throw new Error("Elegí una cantidad entre 1 y el stock disponible.");
  if ((input.deliveryType === "pickup" && !product.pickupToday) || (input.deliveryType === "delivery" && !product.deliveryToday) || !["pickup", "delivery"].includes(input.deliveryType)) throw new Error("Elegí una modalidad de entrega disponible para este producto.");
  const reservations = db.reservations ?? [];
  const nextNumber = reservations.reduce((max, item) => Math.max(max, Number(item.id.slice(4))), 1000) + 1;
  const deliveryPrice = input.deliveryType === "delivery" ? product.deliveryPrice ?? 0 : 0;
  const reservation: Reservation = {
    id: `RES-${nextNumber}`, buyerId: buyer.id, buyerName: buyer.name, buyerPhone: buyer.phone,
    businessId: product.storeId, businessName: product.store, productId: product.id, productName: product.name, productImage: product.image,
    ...(real ? { productSource: "supabase" as const } : {}),
    quantity: input.quantity, unitPrice: product.price, deliveryPrice, total: product.price * input.quantity + deliveryPrice,
    deliveryType: input.deliveryType, status: "PENDING", createdAt: now,
    expiresAt: new Date(Date.parse(now) + 30 * 60 * 1000).toISOString(), confirmedAt: null, readyAt: null, completedAt: null,
  };
  // Only a local snapshot is recorded; Supabase stock is never mutated here.
  const inventory = real ? { ...db.inventory, [product.id]: availableStock(db, product.id, product.stock) } : db.inventory;
  return { reservation, database: { ...db, inventory, reservations: [reservation, ...reservations] } };
}

export type MerchantReservationAction = "confirm" | "reject" | "ready" | "complete";
export function manageReservation(db: RequestDatabase, id: string, businessId: string, action: MerchantReservationAction, now: string): RequestDatabase {
  const reservation = db.reservations?.find(item => item.id === id && item.businessId === businessId);
  if (!reservation) throw new Error("No se encontró la reserva de este comercio.");
  const expected: Record<MerchantReservationAction, ReservationStatus> = { confirm: "PENDING", reject: "PENDING", ready: "CONFIRMED", complete: "READY" };
  if (reservation.status !== expected[action]) throw new Error("La reserva cambió de estado. Revisá su estado actual antes de continuar.");
  if (reservation.status === "PENDING" && Date.parse(reservation.expiresAt) < Date.parse(now)) throw new Error("Esta reserva venció. El comprador debe crear una nueva.");
  let updated: Reservation;
  let inventory = db.inventory;
  switch (action) {
    case "confirm": {
      const stock = availableStock(db, reservation.productId);
      if (stock < reservation.quantity) throw new Error("No hay stock suficiente para confirmar esta reserva.");
      inventory = { ...inventory, [reservation.productId]: stock - reservation.quantity };
      updated = { ...reservation, status: "CONFIRMED", confirmedAt: now };
      break;
    }
    case "reject": updated = { ...reservation, status: "CANCELLED" }; break;
    case "ready": updated = { ...reservation, status: "READY", readyAt: now }; break;
    case "complete": updated = { ...reservation, status: "COMPLETED", completedAt: now }; break;
  }
  return { ...db, inventory, reservations: db.reservations!.map(item => item.id === id ? updated : item) };
}

export function cancelReservation(db: RequestDatabase, id: string, buyerId: string): RequestDatabase {
  const reservation = db.reservations?.find(item => item.id === id && item.buyerId === buyerId);
  if (!reservation) throw new Error("No se encontró tu reserva.");
  if (reservation.status !== "PENDING" && reservation.status !== "CONFIRMED") throw new Error("Esta reserva ya no admite cancelación del comprador.");
  const inventory = reservation.status === "CONFIRMED"
    ? { ...db.inventory, [reservation.productId]: availableStock(db, reservation.productId) + reservation.quantity }
    : db.inventory;
  return { ...db, inventory, reservations: db.reservations!.map(item => item.id === id ? { ...item, status: "CANCELLED" } : item) };
}

// Old databases have neither field. Their requests and offers are kept intact.
export function parseReservationData(value: Record<string, unknown>): Partial<ReservationData> | null {
  if (value.reservations === undefined && value.inventory === undefined) return {};
  if (!Array.isArray(value.reservations)) return null;
  const inventory = value.inventory ?? {};
  if (typeof inventory !== "object" || inventory === null || Array.isArray(inventory)) return null;
  if (Object.entries(inventory).some(([id, stock]) => (!products.some(product => product.id === id) && !isProductUuid(id)) || !Number.isSafeInteger(stock) || Number(stock) < 0)) return null;
  const date = (input: unknown) => typeof input === "string" && Number.isFinite(Date.parse(input));
  const price = (input: unknown) => typeof input === "number" && Number.isFinite(input) && input >= 0;
  for (const item of value.reservations) {
    if (typeof item !== "object" || item === null) return null;
    const r = item as Record<string, unknown>;
    if (["id", "buyerId", "buyerName", "buyerPhone", "businessId", "businessName", "productId", "productName", "productImage"].some(key => typeof r[key] !== "string" || !r[key])) return null;
    const product = products.find(product => product.id === r.productId && product.storeId === r.businessId);
    const realProduct = r.productSource === "supabase" && isProductUuid(String(r.productId)) && isProductUuid(String(r.businessId));
    if ((r.productSource !== undefined && r.productSource !== "supabase") || (!product && !realProduct) || !/^RES-\d+$/.test(String(r.id)) || !Number.isSafeInteger(Number(String(r.id).slice(4))) || !reservationStatuses.includes(r.status as ReservationStatus) || !["pickup", "delivery"].includes(String(r.deliveryType))) return null;
    if (!Number.isSafeInteger(r.quantity) || Number(r.quantity) < 1 || !price(r.unitPrice) || !price(r.deliveryPrice) || !price(r.total)) return null;
    if (Math.abs(Number(r.total) - (Number(r.quantity) * Number(r.unitPrice) + Number(r.deliveryPrice))) > 0.001 || (r.deliveryType === "pickup" && r.deliveryPrice !== 0)) return null;
    if (!date(r.createdAt) || !date(r.expiresAt) || [r.confirmedAt, r.readyAt, r.completedAt].some(timestamp => timestamp !== null && !date(timestamp))) return null;
    if (["CONFIRMED", "READY", "COMPLETED"].includes(String(r.status)) && !date(r.confirmedAt)) return null;
    if (["READY", "COMPLETED"].includes(String(r.status)) && !date(r.readyAt)) return null;
    if (r.status === "COMPLETED" && !date(r.completedAt)) return null;
    if (["CONFIRMED", "READY", "COMPLETED"].includes(String(r.status)) && !(String(r.productId) in inventory)) return null;
  }
  const reservations = value.reservations as Reservation[];
  if (Object.keys(inventory).some(id => isProductUuid(id) && !reservations.some(item => item.productSource === "supabase" && item.productId === id))) return null;
  if (new Set(reservations.map(item => item.id)).size !== reservations.length) return null;
  return { reservations, inventory: inventory as Record<string, number> };
}

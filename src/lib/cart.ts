import type { InventoryMode } from "@/types/database";
import type { DeliveryType } from "@/types/reservations";
import type { Product } from "./products";
import { isProductUuid, validImageUrl } from "./public-catalog";
import { isOnDemand, isProductAvailable } from "./product-availability";

export const CART_STORAGE_KEY = "cercaya:carts:v1";
export const CART_ITEM_LIMIT = 100;
export const CART_QUANTITY_LIMIT = 2147483647;
export interface CartItem {
  productId: string; quantity: number; name: string; image: string; price: number;
  inventoryMode: InventoryMode; stock: number | null;
}
export interface CartAttempt { id: string; ownerId: string; deliveryType: DeliveryType }
export interface Cart {
  businessId: string; businessName: string; businessSlug: string; items: CartItem[];
  deliveryType: DeliveryType; orderId: string; attempt?: CartAttempt; updatedAt: string;
}
export interface CartData { version: 1; carts: Cart[] }
export const emptyCartData = (): CartData => ({ version: 1, carts: [] });
const text = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max;
const quantity = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= CART_QUANTITY_LIMIT;
const delivery = (value: unknown): value is DeliveryType => value === "pickup" || value === "delivery";
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

// Storage is untrusted presentation data. Never use these prices/modes as RPC input.
export function parseCartData(raw: string | null): CartData {
  if (!raw) return emptyCartData();
  const value: unknown = JSON.parse(raw);
  if (!object(value) || value.version !== 1 || !Array.isArray(value.carts)) return emptyCartData();
  const carts: Cart[] = [];
  for (const entry of value.carts) {
    if (!object(entry) || !text(entry.businessId, 36) || !isProductUuid(entry.businessId)
      || !text(entry.businessName, 160) || !text(entry.businessSlug, 400) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.businessSlug)
      || !text(entry.orderId, 36) || !isProductUuid(entry.orderId) || !delivery(entry.deliveryType)
      || !text(entry.updatedAt, 40) || !Number.isFinite(Date.parse(entry.updatedAt))
      || !Array.isArray(entry.items) || entry.items.length < 1 || entry.items.length > CART_ITEM_LIMIT) continue;
    const items: CartItem[] = [];
    for (const item of entry.items) {
      if (!object(item) || !text(item.productId, 36) || !isProductUuid(item.productId) || !quantity(item.quantity)
        || !text(item.name, 160) || !text(item.image, 2048)
        || !(item.image.startsWith("/") && !item.image.startsWith("//") || validImageUrl(item.image))
        || typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 || item.price > 9999999999.99
        || !(item.inventoryMode === "STOCKED" || item.inventoryMode === "ON_DEMAND")
        || !(item.stock === null || typeof item.stock === "number" && Number.isInteger(item.stock) && item.stock >= 0 && item.stock <= CART_QUANTITY_LIMIT)) continue;
      items.push({ productId: item.productId, quantity: item.quantity, name: item.name, image: item.image, price: item.price, inventoryMode: item.inventoryMode, stock: item.stock });
    }
    // Do not silently remove invalid lines from an intent that may already be sent.
    if (items.length !== entry.items.length || new Set(items.map(item => item.productId)).size !== items.length) continue;
    let attempt: CartAttempt | undefined;
    if (entry.attempt !== undefined) {
      if (!object(entry.attempt) || entry.attempt.id !== entry.orderId || !text(entry.attempt.ownerId, 36)
        || !isProductUuid(entry.attempt.ownerId) || !delivery(entry.attempt.deliveryType) || entry.attempt.deliveryType !== entry.deliveryType) continue;
      attempt = { id: entry.orderId, ownerId: entry.attempt.ownerId, deliveryType: entry.attempt.deliveryType };
    }
    if (carts.some(cart => cart.businessId === entry.businessId)) continue;
    carts.push({ businessId: entry.businessId, businessName: entry.businessName, businessSlug: entry.businessSlug, items, deliveryType: entry.deliveryType, orderId: entry.orderId, attempt, updatedAt: entry.updatedAt });
  }
  return { version: 1, carts };
}

export function cartItemFromProduct(product: Product, count: number): CartItem {
  const onDemand = isOnDemand(product);
  return { productId: product.id, quantity: count, name: product.name, image: product.image, price: product.price,
    inventoryMode: onDemand ? "ON_DEMAND" : "STOCKED", stock: onDemand ? null : product.stock };
}
export function cartProductError(product: Product, count: number): string | null {
  const business = product.database?.business;
  if (!business || product.source !== "supabase" || !isProductUuid(product.id) || !isProductUuid(business.id)
    || product.database?.product.business_id !== business.id || !business.active || !product.database.product.active)
    return "Este producto ya no está disponible para agregar al pedido.";
  if (!quantity(count)) return "Revisá la cantidad de este producto.";
  if (!isProductAvailable(product) || !product.pickupToday && !product.deliveryToday) return "Este producto no está disponible para pedir hoy.";
  if (!isOnDemand(product) && count > product.stock) return `Podés pedir hasta ${product.stock} unidades de ${product.name}.`;
  return null;
}

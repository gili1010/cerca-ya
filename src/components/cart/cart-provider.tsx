"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Product } from "@/lib/products";
import type { DeliveryType } from "@/types/reservations";
import { CART_ITEM_LIMIT, CART_QUANTITY_LIMIT, CART_STORAGE_KEY, cartItemFromProduct, cartProductError, emptyCartData, parseCartData, type Cart, type CartAttempt, type CartData } from "@/lib/cart";

interface CartContextValue {
  carts: Cart[]; ready: boolean; storageWarning: string;
  cartFor: (businessId: string) => Cart | undefined;
  addProduct: (product: Product, quantity?: number) => string | null;
  setQuantity: (businessId: string, productId: string, quantity: number) => string | null;
  removeItem: (businessId: string, productId: string) => string | null;
  setDeliveryType: (businessId: string, type: DeliveryType) => string | null;
  beginOrder: (businessId: string, ownerId: string) => CartAttempt | null;
  releaseOrder: (businessId: string, orderId: string) => void;
  clearCart: (businessId: string, orderId?: string) => void;
  refreshCartProducts: (businessId: string, products: Product[]) => void;
}
const CartContext = createContext<CartContextValue | null>(null);
const pendingMessage = "Tu pedido está pendiente de envío o recuperación. Continuá desde el checkout antes de editarlo.";

export function CartProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<CartData>(emptyCartData);
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const current = useRef<CartData>(emptyCartData());
  const loaded = useRef(false);
  const memoryOnly = useRef(false);

  useEffect(() => {
    function hydrate() {
      try { current.current = parseCartData(window.localStorage.getItem(CART_STORAGE_KEY)); memoryOnly.current = false; setStorageWarning(""); }
      catch { memoryOnly.current = true; setStorageWarning("No pudimos recuperar tus pedidos guardados en este navegador."); }
      loaded.current = true; setData(current.current); setReady(true);
    }
    hydrate();
    function changed(event: StorageEvent) { if (event.key === CART_STORAGE_KEY || event.key === null) hydrate(); }
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);

  const latest = useCallback(() => {
    if (!memoryOnly.current) {
      try { current.current = parseCartData(window.localStorage.getItem(CART_STORAGE_KEY)); }
      catch { memoryOnly.current = true; }
    }
    return current.current;
  }, []);
  const save = useCallback((next: CartData, requirePersistence = false) => {
    try { window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next)); memoryOnly.current = false; setStorageWarning(""); }
    catch {
      memoryOnly.current = true;
      setStorageWarning("Tu navegador no permite guardar el pedido. Habilitá el almacenamiento para continuar sin perderlo.");
      if (requirePersistence) return false;
    }
    current.current = next; setData(next); return true;
  }, []);
  const replace = useCallback((snapshot: CartData, cart: Cart | null, businessId: string, requirePersistence = false) =>
    save({ version: 1, carts: cart ? snapshot.carts.map(existing => existing.businessId === businessId ? cart : existing) : snapshot.carts.filter(existing => existing.businessId !== businessId) }, requirePersistence), [save]);

  const addProduct = useCallback((product: Product, count = 1) => {
    if (!loaded.current) return "Estamos recuperando tus pedidos. Intentá nuevamente en un momento.";
    const validation = cartProductError(product, count); if (validation) return validation;
    const business = product.database!.business;
    const snapshot = latest(); const existing = snapshot.carts.find(cart => cart.businessId === business.id);
    if (existing?.attempt) return pendingMessage;
    const previous = existing?.items.find(item => item.productId === product.id);
    const nextQuantity = (previous?.quantity ?? 0) + count;
    const combined = cartProductError(product, nextQuantity); if (combined) return combined;
    if (!previous && (existing?.items.length ?? 0) >= CART_ITEM_LIMIT) return "Tu pedido puede tener hasta 100 productos diferentes.";
    const item = cartItemFromProduct(product, nextQuantity);
    const cart: Cart = { businessId: business.id, businessName: business.name, businessSlug: business.slug,
      orderId: existing?.orderId ?? crypto.randomUUID(), deliveryType: existing?.deliveryType ?? (product.pickupToday ? "pickup" : "delivery"),
      items: previous ? existing!.items.map(line => line.productId === product.id ? item : line) : [...(existing?.items ?? []), item], updatedAt: new Date().toISOString() };
    save({ version: 1, carts: existing ? snapshot.carts.map(value => value.businessId === business.id ? cart : value) : [...snapshot.carts, cart] });
    return null;
  }, [latest, save]);
  const setQuantity = useCallback((businessId: string, productId: string, count: number) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    const item = cart?.items.find(value => value.productId === productId);
    if (!cart || !item) return "Este producto ya no está en tu pedido.";
    if (cart.attempt) return pendingMessage;
    if (!Number.isInteger(count) || count < 1 || count > CART_QUANTITY_LIMIT) return "La cantidad debe ser al menos una unidad.";
    if (count > item.quantity && item.inventoryMode === "STOCKED" && item.stock !== null && count > item.stock) return `Podés pedir hasta ${item.stock} unidades de ${item.name}.`;
    replace(snapshot, { ...cart, items: cart.items.map(line => line.productId === productId ? { ...line, quantity: count } : line), updatedAt: new Date().toISOString() }, businessId);
    return null;
  }, [latest, replace]);
  const removeItem = useCallback((businessId: string, productId: string) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    if (!cart) return null;
    if (cart.attempt) return pendingMessage;
    const items = cart.items.filter(item => item.productId !== productId);
    replace(snapshot, items.length ? { ...cart, items, updatedAt: new Date().toISOString() } : null, businessId); return null;
  }, [latest, replace]);
  const setDeliveryType = useCallback((businessId: string, type: DeliveryType) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    if (!cart) return "No encontramos este pedido.";
    if (cart.attempt) return pendingMessage;
    if (type !== "pickup" && type !== "delivery") return "Seleccioná una modalidad de entrega.";
    replace(snapshot, { ...cart, deliveryType: type, updatedAt: new Date().toISOString() }, businessId); return null;
  }, [latest, replace]);
  const beginOrder = useCallback((businessId: string, ownerId: string) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    if (!cart) return null;
    if (cart.attempt) return cart.attempt.ownerId === ownerId ? cart.attempt : null;
    const attempt: CartAttempt = { id: cart.orderId, ownerId, deliveryType: cart.deliveryType };
    return replace(snapshot, { ...cart, attempt }, businessId, true) ? attempt : null;
  }, [latest, replace]);
  const releaseOrder = useCallback((businessId: string, orderId: string) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    if (!cart?.attempt || cart.attempt.id !== orderId) return;
    replace(snapshot, { ...cart, attempt: undefined, orderId: crypto.randomUUID() }, businessId, true);
  }, [latest, replace]);
  const clearCart = useCallback((businessId: string, orderId?: string) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    if (orderId && cart?.orderId !== orderId) return;
    replace(snapshot, null, businessId, true);
  }, [latest, replace]);
  const refreshCartProducts = useCallback((businessId: string, products: Product[]) => {
    const snapshot = latest(); const cart = snapshot.carts.find(value => value.businessId === businessId);
    if (!cart) return;
    const catalog = new Map(products.map(product => [product.id, product]));
    const next: Cart = { ...cart, items: cart.items.map(item => {
      const product = catalog.get(item.productId);
      return product && product.database?.business.id === businessId ? cartItemFromProduct(product, item.quantity) : item;
    }) };
    if (JSON.stringify(next) !== JSON.stringify(cart)) replace(snapshot, next, businessId);
  }, [latest, replace]);

  const cartFor = useCallback((businessId: string) => current.current.carts.find(cart => cart.businessId === businessId), []);
  return <CartContext.Provider value={{ carts: data.carts, ready, storageWarning,
    cartFor, addProduct, setQuantity, removeItem, setDeliveryType,
    beginOrder, releaseOrder, clearCart, refreshCartProducts }}>{children}</CartContext.Provider>;
}
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Product } from "@/lib/products";
import { getCartCatalog, type CartBusiness } from "@/lib/cart-catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useCart } from "./cart-provider";

export type { CartBusiness } from "@/lib/cart-catalog";

export function useCartCatalog(businessId: string) {
  const { ready, refreshCartProducts } = useCart();
  const [result, setResult] = useState<{ id: string; business: CartBusiness | null; products: Product[]; loading: boolean; error: string }>({ id: businessId, business: null, products: [], loading: true, error: "" });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    setResult(previous => ({ id: businessId, business: previous.id === businessId ? previous.business : null, products: previous.id === businessId ? previous.products : [], loading: true, error: "" }));
    async function load() {
      try {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("unavailable");
        const catalog = await getCartCatalog(client, businessId);
        if (cancelled) return;
        refreshCartProducts(businessId, catalog.products);
        setResult({ id: businessId, ...catalog, loading: false, error: "" });
      } catch {
        if (!cancelled) setResult(previous => ({ ...previous, loading: false, error: "No pudimos actualizar los productos de esta tienda. Intentá nuevamente." }));
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [businessId, ready, revision, refreshCartProducts]);
  const refresh = useCallback(() => { setRevision(value => value + 1); }, []);
  return result.id === businessId ? { business: result.business, products: result.products, loading: result.loading, error: result.error, refresh }
    : { business: null, products: [], loading: true, error: "", refresh };
}

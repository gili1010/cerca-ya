"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { money, type Product } from "@/lib/products";
import { useCart } from "./cart-provider";
import styles from "./cart-entry.module.css";

export function StoreCartBar({ businessId, products }: { businessId: string; products: Product[] }) {
  const { ready, cartFor } = useCart();
  const cart = cartFor(businessId);
  if (!ready || !cart?.items.length) return null;
  const currentProducts = new Map(products.map(product => [product.id, product]));
  const subtotal = cart.items.reduce((sum, item) => sum + (currentProducts.get(item.productId)?.price ?? item.price) * item.quantity, 0);

  return <div className={styles.storeBarSpace}>
    <Link className={styles.storeBar} href={`/carrito/${businessId}`} aria-label={`Ver tu pedido en ${cart.businessName}, ${cart.items.length} productos, subtotal estimado ${money(subtotal)}`}>
      <span className={styles.storeBarIcon}><ShoppingBag size={23} aria-hidden="true" /></span>
      <span className={styles.storeBarSummary}><strong>Tu pedido <span>· {cart.items.length} {cart.items.length === 1 ? "producto" : "productos"}</span></strong><small>Subtotal <b>{money(subtotal)}</b></small></span>
      <span className={styles.storeBarAction}>Ver pedido<ArrowRight size={17} aria-hidden="true" /></span>
    </Link>
  </div>;
}

"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./cart-provider";
import styles from "./cart-entry.module.css";

export function CartAccess() {
  const { carts, ready } = useCart();
  const quantity = ready ? carts.reduce((sum, cart) => sum + cart.items.reduce((count, item) => count + item.quantity, 0), 0) : 0;
  return <Link className={styles.cartAccess} href="/carrito" aria-label={quantity > 0 ? `Tus pedidos en preparación, ${quantity} ${quantity === 1 ? "unidad" : "unidades"}` : "Tus pedidos en preparación"}>
    <ShoppingBag size={20} aria-hidden="true" />
    {quantity > 0 && <span className={styles.badge} aria-hidden="true">{quantity > 99 ? "99+" : quantity}</span>}
  </Link>;
}

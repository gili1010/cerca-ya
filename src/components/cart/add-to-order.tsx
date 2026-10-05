"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import type { Product } from "@/lib/products";
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import { useCart } from "./cart-provider";
import styles from "./cart-entry.module.css";

export function AddToOrder({ product }: { product: Product }) {
  const { ready, addProduct, cartFor } = useCart();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const business = product.database?.business;
  const available = isProductAvailable(product) && product.database?.product.active === true && business?.active === true;
  const canFulfill = product.pickupToday || product.deliveryToday;
  const inCart = business ? cartFor(business.id)?.items.some(item => item.productId === product.id) : false;

  function add() {
    const failure = addProduct(product);
    setError(failure);
    setAdded(!failure);
  }

  const label = !available ? isOnDemand(product) ? "No disponible hoy" : "Sin stock"
    : !canFulfill ? "Consultá cómo comprar al comercio"
    : !ready ? "Cargando tu pedido…" : "Agregar al pedido";

  return <div className={styles.addToOrder}>
    <button type="button" className={`primary-button ${styles.addButton}`} disabled={!ready || !available || !canFulfill || !business} onClick={add}>
      <ShoppingBag size={19} aria-hidden="true" />{label}
    </button>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {added && inCart && business && <div className={styles.added}>
      <p role="status"><Check size={17} aria-hidden="true" />Agregado a tu pedido</p>
      <div className={styles.addedLinks}>
        <Link className="secondary-link" href={`/tienda/${encodeURIComponent(business.slug)}`}>Seguir comprando</Link>
        <Link className="outline-button" href={`/carrito/${business.id}`}>Ver pedido</Link>
      </div>
    </div>}
  </div>;
}

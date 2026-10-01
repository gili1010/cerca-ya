"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock3, Store, Truck } from "lucide-react";
import { money, type Product } from "@/lib/products";
import { type LocalStore } from "@/lib/stores";
import { useProductStock } from "@/lib/request-store";

export function FulfillmentOptions({ product, store }: { product: Product; store: LocalStore }) {
  const [method, setMethod] = useState<"pickup" | "delivery">(product.pickupToday ? "pickup" : "delivery");
  const { ready, stock } = useProductStock(product.id);
  if (!product.pickupToday && !product.deliveryToday) return <div className="later-availability"><Clock3 size={22} /><div><strong>Disponible desde mañana</strong><p>Este producto no tiene entrega ni retiro para hoy en el catálogo demo.</p></div></div>;
  return <section className="fulfillment-options" aria-labelledby="fulfillment-title">
    <h2 id="fulfillment-title">¿Cómo lo querés tener?</h2>
    <fieldset><legend className="sr-only">Modalidad de entrega de ejemplo</legend>
      {product.pickupToday && <label className={method === "pickup" ? "chosen" : ""}><input type="radio" name="fulfillment" value="pickup" checked={method === "pickup"} onChange={() => setMethod("pickup")} /><Store size={22} /><span><strong>Retiro en el local</strong><small>Listo en {product.pickupMinutes} min</small></span><em>Sin costo</em></label>}
      {product.deliveryToday && <label className={method === "delivery" ? "chosen" : ""}><input type="radio" name="fulfillment" value="delivery" checked={method === "delivery"} onChange={() => setMethod("delivery")} /><Truck size={22} /><span><strong>Entrega hoy</strong><small>{store.deliveryArea}</small></span><em>{product.deliveryPrice ? money(product.deliveryPrice) : "Sin costo"}</em></label>}
    </fieldset>
    <p className="fulfillment-summary" role="status">{method === "pickup" ? `${store.pickupInstructions} Dirección de ejemplo: ${store.address}.` : "Envío del comercio con tarifa simulada. No se calcula logística real."} El comercio debe confirmar la reserva antes de preparar el producto.</p>
    {ready && stock > 0 ? <Link className="primary-button product-reserve" href={`/producto/${product.id}/reservar?entrega=${method}`}>Reservar</Link> : <button className="primary-button product-reserve" disabled>{ready ? "Sin stock para reservar" : "Consultando stock…"}</button>}
  </section>;
}

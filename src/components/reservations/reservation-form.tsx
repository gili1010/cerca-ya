"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Minus, Plus, Store, Truck } from "lucide-react";
import { money, type Product } from "@/lib/products";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { reservationError } from "@/lib/real-reservations";
import type { DeliveryType } from "@/types/reservations";
import { useAuth } from "../auth/auth-provider";
import { FormError } from "../requests/request-common";
import { ReservationProduct, ReservationTotals } from "./reservation-common";

export function ReservationForm({ product, initialDeliveryType }: { product: Product; initialDeliveryType?: DeliveryType }) {
  const { user } = useAuth();
  return user ? <ReservationFields key={`${user.id}:${product.id}`} product={product} initialDeliveryType={initialDeliveryType} /> : null;
}
function ReservationFields({ product, initialDeliveryType }: { product: Product; initialDeliveryType?: DeliveryType }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(initialDeliveryType === "delivery" && product.deliveryToday ? "delivery" : product.pickupToday ? "pickup" : "delivery");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const attempt = useRef<{ id: string; quantity: number; deliveryType: DeliveryType } | null>(null);
  const stock = product.stock;
  const deliveryPrice = deliveryType === "delivery" ? product.deliveryPrice ?? 0 : 0;
  const total = product.price * quantity + deliveryPrice;
  const available = product.source === "supabase" && stock > 0 && (product.pickupToday || product.deliveryToday);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !available) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      if (!attempt.current) attempt.current = { id: crypto.randomUUID(), quantity, deliveryType };
      // Reintentos conservan exactamente la misma intención después de perder una respuesta.
      const intent = attempt.current;
      const { data, error: failure } = await client.rpc("create_my_reservation", {
        p_reservation_id: intent.id, p_product_id: product.id, p_quantity: intent.quantity,
        p_delivery_type: intent.deliveryType === "pickup" ? "PICKUP" : "DELIVERY",
      });
      if (failure) {
        setError(reservationError(failure, true));
        // Errores explícitos de validación no guardaron una reserva. Los errores de
        // transporte son ambiguos: conservar UUID y datos para recuperar el resultado.
        if (failure.code === "22023" || failure.code === "42501") attempt.current = null;
        setBusy(false); submitting.current = false; return;
      }
      router.push(`/reserva/${data}/confirmacion`);
    } catch { setError("No pudimos crear la reserva. Volvé a intentar con los mismos datos."); setBusy(false); submitting.current = false; }
  }
  const locked = busy || attempt.current !== null;
  return <div className="workflow-narrow"><Link className="secondary-link" href={`/producto/${product.id}`}>Volver al producto</Link><div className="workflow-heading"><span className="eyebrow">Reservá cerca tuyo</span><h1>Reservar producto</h1><p>El comercio confirma la disponibilidad antes de preparar tu pedido.</p></div><form className="panel workflow-form reservation-form" onSubmit={submit}>
    <ReservationProduct name={product.name} image={product.image} business={product.store} productId={product.id} />
    <p className="offer-stock">Stock informado: {stock} unidades · {money(product.price)} c/u</p>
    <div className="reservation-quantity"><span id="quantity-label">Cantidad</span><div role="group" aria-labelledby="quantity-label"><button type="button" aria-label="Restar una unidad" disabled={locked || quantity <= 1 || !available} onClick={() => setQuantity(quantity - 1)}><Minus size={18} /></button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Sumar una unidad" disabled={locked || quantity >= stock || !available} onClick={() => setQuantity(quantity + 1)}><Plus size={18} /></button></div></div>
    <fieldset className="reservation-delivery" disabled={locked || !available}><legend>¿Cómo lo querés recibir?</legend>
      {product.pickupToday && <label className={deliveryType === "pickup" ? "chosen" : ""}><input type="radio" name="deliveryType" checked={deliveryType === "pickup"} onChange={() => setDeliveryType("pickup")} /><Store size={19} /><span>Retirar en comercio<small>Sin costo</small></span></label>}
      {product.deliveryToday && <label className={deliveryType === "delivery" ? "chosen" : ""}><input type="radio" name="deliveryType" checked={deliveryType === "delivery"} onChange={() => setDeliveryType("delivery")} /><Truck size={19} /><span>Envío del comercio<small>{money(deliveryPrice)}</small></span></label>}
    </fieldset>
    {!available && <p className="form-error">Este producto ya no está disponible para reservar.</p>}
    <ReservationTotals quantity={quantity} unitPrice={product.price} deliveryPrice={deliveryPrice} deliveryType={deliveryType} total={total} />
    <p className="info-note">La reserva se envía al comercio y vence en 30 minutos si no la confirma. El precio y envío vigentes se calculan al guardar; podés revisar el total final en el detalle. No se realiza ningún cobro.</p><FormError message={error} />
    <button className="primary-button" type="submit" disabled={!available || busy}>{busy ? "Guardando reserva..." : attempt.current ? "Reintentar reserva" : "Confirmar reserva"}</button>
  </form></div>;
}

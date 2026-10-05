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
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import { emptyReservationCheckout, normalizeReservationCheckout, validateReservationCheckout } from "@/lib/reservation-checkout";
import { ReservationCheckoutFields } from "./reservation-checkout-fields";

export function ReservationForm({ product, initialDeliveryType }: { product: Product; initialDeliveryType?: DeliveryType }) {
  const { user, profile, profileLoading } = useAuth();
  if (user && profileLoading) return <p className="workflow-loading" role="status">Cargando tus datos de contacto…</p>;
  return user ? <ReservationFields key={`${user.id}:${product.id}`} product={product} initialDeliveryType={initialDeliveryType} initialName={profile?.full_name ?? ""} initialPhone={profile?.phone ?? ""} /> : null;
}
function ReservationFields({ product, initialDeliveryType, initialName, initialPhone }: { product: Product; initialDeliveryType?: DeliveryType; initialName: string; initialPhone: string }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [deliveryType, setDeliveryType] = useState<DeliveryType>(initialDeliveryType === "delivery" && product.deliveryToday ? "delivery" : product.pickupToday ? "pickup" : "delivery");
  const [checkout, setCheckout] = useState(() => ({ ...emptyReservationCheckout, customer_name: initialName, customer_phone: initialPhone }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const attempt = useRef<{ id: string; quantity: number; deliveryType: DeliveryType; checkout: ReturnType<typeof normalizeReservationCheckout> } | null>(null);
  const stock = product.stock;
  const onDemand = isOnDemand(product);
  const deliveryPrice = deliveryType === "delivery" ? product.deliveryPrice ?? 0 : 0;
  const total = product.price * quantity + deliveryPrice;
  const available = product.source === "supabase" && isProductAvailable(product) && (product.pickupToday || product.deliveryToday);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !available) return;
    if (!attempt.current) {
      const validation = validateReservationCheckout(checkout, deliveryType === "pickup" ? "PICKUP" : "DELIVERY");
      if (validation) { setError(validation); return; }
    }
    submitting.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      if (!attempt.current) attempt.current = { id: crypto.randomUUID(), quantity, deliveryType, checkout: normalizeReservationCheckout(checkout, deliveryType === "pickup" ? "PICKUP" : "DELIVERY") };
      // Reintentos conservan exactamente la misma intención después de perder una respuesta.
      const intent = attempt.current;
      const { data, error: failure } = await client.rpc("create_my_reservation", {
        p_reservation_id: intent.id, p_product_id: product.id, p_quantity: intent.quantity,
        p_delivery_type: intent.deliveryType === "pickup" ? "PICKUP" : "DELIVERY",
        p_checkout: intent.checkout,
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
    <p className="offer-stock">{onDemand ? "Se prepara a pedido" : `Stock informado: ${stock} unidades`} · {money(product.price)} c/u</p>
    <div className="reservation-quantity"><span id="quantity-label">Cantidad</span><div role="group" aria-labelledby="quantity-label"><button type="button" aria-label="Restar una unidad" disabled={locked || quantity <= 1 || !available} onClick={() => setQuantity(quantity - 1)}><Minus size={18} /></button><output aria-live="polite">{quantity}</output><button type="button" aria-label="Sumar una unidad" disabled={locked || quantity >= (onDemand ? 2147483647 : stock) || !available} onClick={() => setQuantity(quantity + 1)}><Plus size={18} /></button></div></div>
    <fieldset className="reservation-delivery" disabled={locked || !available}><legend>¿Cómo lo querés recibir?</legend>
      {product.pickupToday && <label className={deliveryType === "pickup" ? "chosen" : ""}><input type="radio" name="deliveryType" checked={deliveryType === "pickup"} onChange={() => setDeliveryType("pickup")} /><Store size={19} /><span>Retirar en comercio<small>Sin costo</small></span></label>}
      {product.deliveryToday && <label className={deliveryType === "delivery" ? "chosen" : ""}><input type="radio" name="deliveryType" checked={deliveryType === "delivery"} onChange={() => setDeliveryType("delivery")} /><Truck size={19} /><span>Envío del comercio<small>{money(deliveryPrice)}</small></span></label>}
    </fieldset>
    {deliveryType === "pickup" && <p className="info-note">Retirá en {product.store}: {product.database?.business.address || "Dirección sin informar"}{product.database?.business.city ? `, ${product.database.business.city}` : ""}.</p>}
    <ReservationCheckoutFields value={checkout} onChange={setCheckout} delivery={deliveryType === "delivery"} disabled={locked || !available} acceptsCash={product.database?.business.accepts_cash === true} acceptsTransfer={product.database?.business.accepts_transfer === true} />
    {!available && <p className="form-error">Este producto ya no está disponible para reservar.</p>}
    <ReservationTotals quantity={quantity} unitPrice={product.price} deliveryPrice={deliveryPrice} deliveryType={deliveryType} total={total} />
    <p className="info-note">La reserva se envía al comercio y vence en 30 minutos si no la confirma. El precio y envío vigentes se calculan al guardar; podés revisar el total final en el detalle. No se realiza ningún cobro.</p><FormError message={error} />
    <button className="primary-button" type="submit" disabled={!available || busy}>{busy ? "Guardando reserva..." : attempt.current ? "Reintentar reserva" : "Enviar reserva"}</button>
  </form></div>;
}

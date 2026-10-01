"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessRow, ProductRow, RadarRequestRow } from "@/types/database";
import { canOfferProduct } from "@/lib/real-radar";
import { isUuid, offerError, validateOffer, type RealOfferInput } from "@/lib/real-offers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { MerchantBusinessGate } from "../merchant-products/business-gate";
import { FormError } from "./request-common";
import { useLiveRadar } from "../radar/use-live-radar";
import { LiveFeedback } from "./use-live-changes";
import { useRequestClock } from "./buyer-request-common";

export function RealOfferForm({ requestId, productId }: { requestId: string; productId?: string }) {
  return <MerchantBusinessGate>{business => <LoadOfferForm key={business.id} business={business} requestId={requestId} productId={productId} />}</MerchantBusinessGate>;
}
function LoadOfferForm({ business, requestId, productId }: { business: BusinessRow; requestId: string; productId?: string }) {
  const data = useLiveRadar(business.id, requestId, business.updated_at);
  const now = useRequestClock();
  if (!business.active) return <UnavailableForm message="Necesitás un comercio activo para enviar ofertas." />;
  if (data.loading) return <p className="workflow-loading" role="status">Cargando oportunidades...</p>;
  if (data.error) return <section className="panel"><FormError message={data.error} /><button className="outline-button" onClick={() => void data.refresh()}>Reintentar</button></section>;
  const request = data.data?.requests[0];
  if (!request || Date.parse(request.expires_at) <= now) return <UnavailableForm message="Este pedido ya no acepta ofertas." />;
  if (request.my_offer_id) return <section className="empty-state"><h1>✅ Ya enviaste una oferta</h1><p>Ya enviaste una oferta para este pedido.</p><Link className="primary-button" href={`/comercio/oferta-enviada/${request.my_offer_id}`}>Ver mi oferta</Link><Link className="secondary-link" href="/comercio/radar">Volver al Radar</Link></section>;
  const product = productId ? data.data?.products.find(row => row.id === productId) : undefined;
  if (productId && (!isUuid(productId) || !product || !canOfferProduct(product, business))) return <section className="empty-state"><h1>Este producto no está disponible para ofrecer</h1><p>Revisá el stock y las opciones de entrega de tu catálogo.</p><Link className="primary-button" href={`/comercio/oportunidades/${requestId}/responder`}>Ofrecer otro producto</Link></section>;
  return <><LiveFeedback state={data.live} /><button className="secondary-link" disabled={data.busy} onClick={() => void data.refresh()}>{data.busy ? "Actualizando..." : "Actualizar pedido"}</button><OfferFields key={`${data.userId}:${business.id}:${request.id}:${productId ?? "manual"}`} business={business} request={request} product={product} refresh={data.refresh} /></>;
}
function UnavailableForm({ message }: { message: string }) {
  return <section className="empty-state"><h1>{message}</h1><Link className="primary-button" href="/comercio/radar">Volver al Radar</Link></section>;
}
function OfferFields({ business, request, product, refresh }: { business: BusinessRow; request: RadarRequestRow; product?: ProductRow; refresh: () => Promise<unknown> }) {
  const router = useRouter();
  const pickupAllowed = business.pickup_enabled && (!product || product.pickup_enabled);
  const deliveryAllowed = business.delivery_enabled && (!product || product.delivery_enabled);
  const [form, setForm] = useState<RealOfferInput>(() => ({
    product_name: product?.name ?? request.title, description: product?.description ?? "", price: product?.price ?? 0,
    pickup_available: pickupAllowed, delivery_available: deliveryAllowed,
    delivery_price: deliveryAllowed ? business.delivery_price : 0, estimated_delivery: "", alternative: false,
  }));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  async function submit() {
    if (inFlight.current) return;
    const input = { ...form, product_name: form.product_name.trim(), description: form.description.trim(), delivery_price: form.delivery_available ? form.delivery_price : 0, estimated_delivery: form.estimated_delivery.trim() };
    const validation = validateOffer(input);
    if (validation) { setError(validation); return; }
    inFlight.current = true; setSubmitting(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { data, error: failure } = await client.rpc("create_my_offer", {
        p_request_id: request.id, p_product_id: product?.id ?? null,
        p_product_name: input.product_name, p_description: input.description, p_price: input.price,
        p_pickup_available: input.pickup_available, p_delivery_available: input.delivery_available,
        p_delivery_price: input.delivery_price, p_estimated_delivery: input.estimated_delivery, p_alternative: input.alternative,
      });
      if (failure) {
        setError(offerError(failure));
        if (failure.code === "23505" || failure.message.includes("offer_request_unavailable")) await refresh();
        inFlight.current = false; setSubmitting(false); return;
      }
      router.push(`/comercio/oferta-enviada/${data}`);
    } catch { setError("No pudimos enviar la oferta."); inFlight.current = false; setSubmitting(false); }
  }
  return <div className="workflow-narrow"><Link className="secondary-link" href="/comercio/radar">Volver al Radar</Link><div className="workflow-heading"><span className="eyebrow">{business.name}</span><h1>Respondé con una oferta</h1><p>{request.title}</p>{product && <p>Precargamos tu producto. Revisá la compatibilidad, el precio y el tiempo de entrega antes de enviar.</p>}</div>
    <form className="workflow-form panel" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor="offered-product">Producto ofrecido<input id="offered-product" required minLength={3} maxLength={120} disabled={submitting} value={form.product_name} onChange={event => setForm({ ...form, product_name: event.target.value })} /></label>
      <label htmlFor="offered-price">Precio (ARS)<input id="offered-price" type="number" inputMode="decimal" required min="0.01" max="9999999999.99" step="0.01" disabled={submitting} value={form.price || ""} onChange={event => setForm({ ...form, price: Number(event.target.value) })} /></label>
      <label htmlFor="offer-description">Descripción<textarea id="offer-description" required minLength={3} maxLength={1000} disabled={submitting} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="Estado, compatibilidad y detalles para el comprador." /></label>
      <fieldset className="form-checkboxes" disabled={submitting}><legend>¿Cómo lo puede recibir?</legend><label><input type="checkbox" disabled={!pickupAllowed} checked={form.pickup_available} onChange={event => setForm({ ...form, pickup_available: event.target.checked })} />Retiro disponible</label><label><input type="checkbox" disabled={!deliveryAllowed} checked={form.delivery_available} onChange={event => setForm({ ...form, delivery_available: event.target.checked, delivery_price: event.target.checked ? business.delivery_price : 0 })} />Envío disponible</label></fieldset>
      {!pickupAllowed && !deliveryAllowed && <p className="info-note">Habilitá retiro o envío en tu comercio antes de ofrecer.</p>}
      {form.delivery_available && <label htmlFor="delivery-price">Costo de envío (ARS)<input id="delivery-price" type="number" inputMode="decimal" required min="0" max="9999999999.99" step="0.01" disabled={submitting} value={form.delivery_price} onChange={event => setForm({ ...form, delivery_price: Number(event.target.value) })} /></label>}
      <label htmlFor="estimated-delivery">Tiempo estimado de {form.delivery_available ? "entrega" : "retiro"}<input id="estimated-delivery" required={form.delivery_available} maxLength={120} disabled={submitting} value={form.estimated_delivery} onChange={event => setForm({ ...form, estimated_delivery: event.target.value })} placeholder={form.delivery_available ? "Hoy, en 2 horas" : "Retiro inmediato"} /></label>
      <label className="checkbox-label"><input type="checkbox" disabled={submitting} checked={form.alternative} onChange={event => setForm({ ...form, alternative: event.target.checked })} />Es una alternativa al producto solicitado</label>
      <p className="info-note">La oferta quedará guardada y el comprador podrá consultarla al actualizar su pedido.</p><FormError message={error} /><button className="primary-button" type="submit" disabled={submitting || (!pickupAllowed && !deliveryAllowed)}>{submitting ? "Enviando oferta..." : "Enviar oferta"}</button>
    </form>
  </div>;
}


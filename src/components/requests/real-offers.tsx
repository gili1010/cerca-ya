"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { PublicOfferRow } from "@/types/database";
import { offerStatusLabels, offerWhatsApp } from "@/lib/real-offers";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { money } from "@/lib/products";
import { formatArgentinaPhone } from "@/lib/phone";
import { useLiveOffers } from "./use-live-offers";
import { LiveFeedback } from "./use-live-changes";
import { FormError } from "./request-common";

function OfferFacts({ offer }: { offer: PublicOfferRow }) {
  return <><div className="card-topline"><strong>{offer.business_name}</strong><span className={`request-status ${offer.status === "PENDING" ? "open" : "closed"}`}>{offerStatusLabels[offer.status]}</span></div>
    {offer.business_city && <p>{offer.business_city}</p>}{offer.business_whatsapp && <p>WhatsApp: {formatArgentinaPhone(offer.business_whatsapp)}</p>}
    <strong className="offer-price">{money(offer.price)}</strong><p className="request-description">{offer.description}</p>
    <div className="offer-methods">{offer.pickup_available && <span>Retiro disponible</span>}{offer.delivery_available && <span>Envío disponible · {money(offer.delivery_price)}</span>}</div>
    {offer.estimated_delivery && <p>Tiempo estimado: {offer.estimated_delivery}</p>}{offer.alternative && <span className="alternative-badge">Alternativa al producto solicitado</span>}
    <p className="info-note"><time dateTime={offer.created_at}>Enviada el {new Date(offer.created_at).toLocaleString("es-AR")}</time></p>
    {offer.status === "WITHDRAWN" && <p className="info-note">Oferta retirada</p>}
  </>;
}
export function BuyerOfferList({ requestId }: { requestId: string }) {
  const data = useLiveOffers(requestId);
  return <section><div className="offers-heading"><h2>Ofertas recibidas{data.data ? ` (${data.data.length})` : ""}</h2><button className="outline-button" disabled={data.busy} onClick={() => void data.refresh()}>{data.busy ? "Actualizando..." : "Actualizar"}</button></div>
    <LiveFeedback state={data.live} notice={data.notice} />
    {data.loading && <p className="workflow-loading" role="status">Cargando ofertas...</p>}<FormError message={data.error} />
    {data.data && (data.data.length ? <div className="offer-grid">{data.data.map(offer => <article className="panel offer-card" key={offer.id}><h3>{offer.product_name}</h3><OfferFacts offer={offer} /><Link className="offer-link" href={`/pedido/${requestId}/oferta/${offer.id}`}>Ver oferta</Link></article>)}</div> : <div className="empty-state"><h2>Todavía no hay ofertas.</h2><p>Las respuestas aparecen automáticamente. También podés usar Actualizar.</p></div>)}
  </section>;
}
export function RealOfferDetail({ requestId, offerId, seller = false }: { requestId?: string; offerId: string; seller?: boolean }) {
  const data = useLiveOffers(requestId, offerId, seller);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const offer = data.data?.[0];
  const whatsapp = offer ? offerWhatsApp(offer) : null;
  const back = seller ? "/comercio/radar" : requestId ? `/pedido/${requestId}` : "/pedidos";
  async function withdraw() {
    if (!offer || offer.status !== "PENDING" || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { error: failure } = await client.rpc("withdraw_my_offer", { p_offer_id: offer.id });
      if (failure) throw failure;
      await data.refresh();
    } catch { setError("No pudimos retirar la oferta. Actualizá para comprobar su estado y volvé a intentar."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="workflow-narrow"><Link className="secondary-link" href={back}>{seller ? "Volver al Radar" : "Volver a mi pedido"}</Link><div className="offers-heading"><h1>{seller ? "Mi oferta" : "Detalle de oferta"}</h1><button className="outline-button" disabled={data.busy || busy} onClick={() => void data.refresh()}>Actualizar</button></div>
    <LiveFeedback state={data.live} notice={data.notice} />
    {data.loading && <p className="workflow-loading" role="status">Cargando ofertas...</p>}<FormError message={data.error} />
    {!data.loading && !data.error && !offer && <section className="empty-state"><h2>Esta oferta no está disponible para tu cuenta.</h2><p>Comprobá que ingresaste con la cuenta correspondiente.</p></section>}
    {offer && <article className="panel offer-detail"><span className="eyebrow">{seller ? "OFERTA GUARDADA EN TU COMERCIO" : "OFERTA RECIBIDA"}</span><h2>{offer.product_name}</h2><OfferFacts offer={offer} /><FormError message={error} />
      <div className="offer-detail-actions">{seller && offer.status === "PENDING" && <button className="outline-button" disabled={busy} onClick={() => void withdraw()}>{busy ? "Retirando oferta..." : "Retirar oferta"}</button>}
      {!seller && whatsapp && offer.status === "PENDING" && <a className="primary-button" href={whatsapp} target="_blank" rel="noopener noreferrer">Hablar por WhatsApp</a>}</div>
      {!seller && !whatsapp && <p className="info-note">Este comercio no tiene un WhatsApp disponible.</p>}
    </article>}
  </div>;
}



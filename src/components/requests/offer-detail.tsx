"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/auth-provider";
import { loginUrl } from "@/lib/auth/redirect";
import { Check, MapPin, MessageCircle, Store, Truck } from "lucide-react";
import { businesses, DEMO_BUYER_ID } from "@/data/businesses";
import { requestActions, useRequests } from "@/lib/request-store";
import { distance, money } from "@/lib/products";
import { Dialog } from "../home/dialog";
import { FormError, LoadingRequests, MissingRequest } from "./request-common";

export function OfferDetail({ requestId, offerId }: { requestId: string; offerId: string }) {
  const { ready, database } = useRequests();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const requireLogin = () => { if (!user) { router.push(loginUrl(`/demo/pedido/${requestId}/oferta/${offerId}`)); return true; } return false; };
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  if (!ready) return <LoadingRequests />;
  const request = database.requests.find(item => item.id === requestId && item.buyerId === DEMO_BUYER_ID);
  const offer = database.offers.find(item => item.id === offerId && item.requestId === requestId);
  if (!request || !offer) return <MissingRequest offer />;
  const business = businesses.find(item => item.id === offer.businessId);
  const reserved = request.reservedOfferId === offer.id;
  const canReserve = request.status === "OPEN" && offer.stockAvailable;
  const whatsapp = business ? `https://wa.me/${business.whatsapp}?text=${encodeURIComponent(`Consulta de DEMO CercaYa sobre ${offer.productName}, pedido ${request.id}.`)}` : null;
  return <div className="workflow-narrow"><Link className="secondary-link" href={`/demo/pedido/${requestId}`}>Volver a {request.title}</Link><article className="panel offer-detail"><span className="eyebrow">OFERTA {offer.id}</span>{offer.alternative && <span className="alternative-badge">Alternativa al producto solicitado</span>}<h1>{offer.productName}</h1><strong className="offer-price">{money(offer.price)}</strong><div className="offer-business"><Store size={23} /><div><strong>{offer.businessName}</strong><span><MapPin size={13} />A {distance(offer.distanceKm)} · Distancia simulada</span></div></div><div className="offer-stock"><Check size={17} />{offer.stockAvailable ? "Stock disponible" : "Sin stock"}</div><h2>Descripción del vendedor</h2><p className="request-description">{offer.description}</p><h2>Entrega o retiro</h2><div className="offer-methods">{offer.pickupAvailable && <span><Store size={18} />Retiro inmediato</span>}{offer.deliveryAvailable && <span><Truck size={18} />{offer.estimatedDelivery}</span>}</div><p className="info-note">El precio corresponde al producto. Si hay envío, su costo y condiciones se coordinarían con el comercio en una versión real.</p>
      {reserved && <p className="reservation-notice" role="status">¡Reserva de prueba registrada! El pedido quedó cerrado. No se descontó stock real ni se realizó ningún cobro.</p>}
      {!canReserve && !reserved && <p className="info-note">{request.status !== "OPEN" ? "Este pedido está cerrado o cancelado y ya no permite reservar." : "Esta oferta no tiene stock disponible."}</p>}
      <div className="offer-detail-actions"><button className="primary-button" disabled={!canReserve || authLoading} onClick={() => { if (requireLogin()) return; setError(""); setConfirm(true); }}>{reserved ? "Reservado en demo" : "Reservar"}</button>{whatsapp && <a className="outline-button" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} />Hablar por WhatsApp</a>}</div>
      <p className="external-note">WhatsApp abre un número ficticio de prueba. No corresponde a un comercio real y la app no envía mensajes automáticamente.</p>
    </article>
    {confirm && <Dialog title="Confirmar reserva de prueba" onClose={() => setConfirm(false)}><div className="dialog-body text-dialog"><h2>Reservar en la demo</h2><p>Vas a seleccionar esta oferta y cerrar el pedido. Esto no genera una compra, un pago ni una reserva en un comercio real.</p><FormError message={error} /><div className="dialog-actions"><button className="primary-button" onClick={() => { try { if (requireLogin()) return; requestActions.reserve(offer.id); setConfirm(false); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo registrar la reserva."); } }}>Confirmar reserva de prueba</button><button onClick={() => setConfirm(false)}>Volver</button></div></div></Dialog>}
  </div>;
}



"use client";

import Link from "next/link";
import { useState } from "react";
import { Megaphone, Store } from "lucide-react";
import { DEMO_BUYER_ID } from "@/data/businesses";
import { requestActions, useRequests } from "@/lib/request-store";
import { Dialog } from "../home/dialog";
import { OfferCard } from "./offer-card";
import { FormError, LoadingRequests, MissingRequest, RelativeDate, RequestFacts, RequestStatusBadge } from "./request-common";

export function RequestDetail({ id }: { id: string }) {
  const { ready, database } = useRequests();
  const [action, setAction] = useState<"close" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [sort, setSort] = useState("recent");
  if (!ready) return <LoadingRequests />;
  const request = database.requests.find(item => item.id === id && item.buyerId === DEMO_BUYER_ID);
  if (!request) return <MissingRequest />;
  const offers = database.offers.filter(offer => offer.requestId === id).sort((a, b) => sort === "price" ? a.price - b.price : sort === "distance" ? a.distanceKm - b.distanceKm : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <><Link className="secondary-link" href="/pedidos">Mis pedidos / {request.id}</Link><section className="panel request-overview"><div className="card-topline"><span>{request.id}</span><RequestStatusBadge request={request} /></div><h1>{request.title}</h1><RelativeDate date={request.createdAt} /><p className="request-description">{request.description || "No agregaste una descripción."}</p><RequestFacts request={request} />{request.reservedOfferId && <p className="reservation-notice" role="status">Reserva de prueba registrada. El pedido está cerrado y ya no recibe ofertas. <Link href={`/demo/pedido/${id}/oferta/${request.reservedOfferId}`}>Ver oferta reservada</Link></p>}{request.status === "OPEN" && <div className="request-actions"><button onClick={() => { setError(""); setAction("close"); }}>Cerrar pedido</button><button onClick={() => { setError(""); setAction("cancel"); }}>Cancelar pedido</button></div>}</section>
    <div className="offers-heading"><h2>Ofertas recibidas <span>{offers.length}</span></h2><label>Ordenar<select aria-label="Ordenar ofertas" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Más recientes</option><option value="price">Menor precio</option><option value="distance">Más cercanas</option></select></label></div>
    {request.status !== "OPEN" && <p className="info-note">Este pedido está {request.status === "CANCELLED" ? "cancelado" : "cerrado"}. Podés consultar sus ofertas, pero no recibir ni reservar otras.</p>}
    <div className="offer-grid">{offers.map(offer => <OfferCard key={offer.id} offer={offer} />)}</div>
    {!offers.length && <div className="empty-state"><Megaphone size={30} /><h2>{request.status === "OPEN" ? "Estamos buscando comercios" : "Este pedido no recibió ofertas"}</h2><p>{request.status === "OPEN" ? "Probá cómo responde un vendedor desde el modo comercio. La oferta aparecerá acá automáticamente." : "Podés crear un nuevo pedido cuando lo necesites."}</p>{request.status === "OPEN" && <Link className="primary-button" href="/comercio/oportunidades"><Store size={17} />Probar modo comercio</Link>}</div>}
    {action && <Dialog title={action === "close" ? "Cerrar pedido" : "Cancelar pedido"} onClose={() => setAction(null)}><div className="dialog-body text-dialog"><h2>{action === "close" ? "¿Cerrar este pedido?" : "¿Cancelar este pedido?"}</h2><p>Se conservarán los datos y las ofertas, pero el pedido dejará de recibir respuestas. Podrás crear otro pedido si lo necesitás.</p><FormError message={error} /><div className="dialog-actions"><button className="primary-button" onClick={() => { try { requestActions[action](id); setAction(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el pedido."); } }}>{action === "close" ? "Cerrar pedido" : "Cancelar pedido"}</button><button onClick={() => setAction(null)}>Volver</button></div></div></Dialog>}
  </>;
}


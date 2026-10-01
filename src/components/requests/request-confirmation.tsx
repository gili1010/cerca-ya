"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useRequests } from "@/lib/request-store";
import { DEMO_BUYER_ID } from "@/data/businesses";
import { LoadingRequests, MissingRequest, RequestFacts, RequestStatusBadge } from "./request-common";

export function RequestConfirmation({ id }: { id: string }) {
  const { ready, database } = useRequests();
  if (!ready) return <LoadingRequests />;
  const request = database.requests.find(item => item.id === id && item.buyerId === DEMO_BUYER_ID);
  if (!request) return <MissingRequest />;
  return <section className="workflow-narrow confirmation panel"><span className="confirmation-icon"><Check size={32} /></span><h1>¡Pedido publicado!</h1><p>Ahora los comercios cercanos pueden enviarte ofertas.</p><small>En esta demo, las ofertas llegan desde el modo comercio de este navegador.</small><div className="confirmation-summary"><span className="eyebrow">{request.id}</span><h2>{request.title}</h2><RequestFacts request={request} />{request.status === "OPEN" && request.offersCount === 0 ? <span className="request-status open"><i />Buscando comercios</span> : <RequestStatusBadge request={request} />}</div><Link className="primary-button" href={`/pedido/${request.id}`}>Ver mi pedido</Link><Link className="secondary-link" href="/pedidos">Ir a Mis pedidos</Link></section>;
}

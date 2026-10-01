"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, MapPin, Megaphone, Plus } from "lucide-react";
import { DEMO_BUYER_ID } from "@/data/businesses";
import { useRequests } from "@/lib/request-store";
import { LoadingRequests, RelativeDate, RequestStatusBadge } from "./request-common";

export function RequestList() {
  const { ready, database } = useRequests();
  const [filter, setFilter] = useState("ALL");
  if (!ready) return <LoadingRequests />;
  const requests = database.requests.filter(item => item.buyerId === DEMO_BUYER_ID && (filter === "ALL" || item.status === filter)).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return <><div className="workflow-heading with-action"><div><span className="eyebrow">LO QUE NECESITÁS, EN UN LUGAR</span><h1>Mis pedidos</h1><p>Seguí tus búsquedas y compará las ofertas de los comercios.</p></div><Link className="primary-button" href="/pedido/nuevo"><Plus size={16} />Nuevo pedido</Link></div>
    <div className="request-tabs" role="group" aria-label="Filtrar pedidos">{[["ALL", "Todos"], ["OPEN", "Abiertos"], ["CLOSED", "Cerrados"], ["CANCELLED", "Cancelados"]].map(([value, label]) => <button className={`filter-chip ${filter === value ? "selected" : ""}`} key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="request-list-grid">{requests.map(request => <article className="panel request-card" key={request.id}><div className="card-topline"><span>{request.id}</span><RequestStatusBadge request={request} /></div><h2><Link href={`/pedido/${request.id}`}>{request.title}</Link></h2><RelativeDate date={request.createdAt} /><div className="request-card-meta"><span><MapPin size={15} />Hasta {request.radiusKm} km</span><span>{request.neededWhen}</span></div><div className="request-card-bottom"><strong>{request.offersCount ? `${request.offersCount} ${request.offersCount === 1 ? "oferta recibida" : "ofertas recibidas"}` : "Esperando ofertas"}</strong><Link href={`/pedido/${request.id}`}>Ver pedido <ArrowRight size={15} /></Link></div></article>)}</div>
    {!requests.length && <div className="empty-state"><Megaphone size={28} /><h2>No hay pedidos en esta lista</h2><p>Publicá lo que necesitás para probar el flujo con comercios cercanos.</p><Link className="primary-button" href="/pedido/nuevo">Crear pedido</Link></div>}
  </>;
}

"use client";
import { BackLink, BackButton } from "@/components/navigation/back-link";

import Link from "next/link";
import { useRef, useState } from "react";
import { ArrowRight, Check, Megaphone, Plus } from "lucide-react";
import { displayedRequestStatus, requestUrgencies, requestsPageSize, type BuyerRequestFilter } from "@/lib/buyer-requests";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useBuyerRequests } from "./buyer-request-data";
import { BuyerRequestBadge, BuyerRequestFacts, UnavailableBuyerRequest, useRequestClock } from "./buyer-request-common";
import { FormError, RelativeDate } from "./request-common";
import { Dialog } from "../home/dialog";
import { BuyerOfferList } from "./real-offers";
import { LiveFeedback } from "./use-live-changes";

export function BuyerRequestList() {
  const [filter, setFilter] = useState<BuyerRequestFilter>("ALL");
  const [page, setPage] = useState(0);
  const data = useBuyerRequests(filter, page);
  const now = useRequestClock();
  const filters: [BuyerRequestFilter, string][] = [["ALL", "Todos"], ["OPEN", "Abiertos"], ["CLOSED", "Cerrados"], ["CANCELLED", "Cancelados"], ["EXPIRED", "Expirados"]];
  return <><div className="workflow-heading with-action"><div><span className="eyebrow">LO QUE NECESITÁS, EN UN LUGAR</span><h1>Mis pedidos</h1><p>Consultá los pedidos de tu cuenta y su estado.</p></div><Link className="primary-button" href="/pedido/nuevo"><Plus size={16} />Nuevo pedido</Link></div>
    <LiveFeedback state={data.live} notice={data.notice} /><button className="secondary-link" onClick={() => void data.refresh()}>Actualizar</button>
    <div className="request-tabs" role="group" aria-label="Filtrar pedidos">{filters.map(([value, label]) => <button className={`filter-chip ${filter === value ? "selected" : ""}`} key={value} aria-pressed={filter === value} onClick={() => { setFilter(value); setPage(0); }}>{label}</button>)}</div>
    {data.loading && <p className="workflow-loading" role="status">Cargando pedidos...</p>}
    <FormError message={data.error} />{data.error && <button className="outline-button" onClick={() => void data.refresh()}>Reintentar</button>}
    {!data.loading && !data.error && <><div className="request-list-grid">{data.requests.map(request => <article className="panel request-card" key={request.id}><div className="card-topline"><span className="buyer-request-id">{request.id}</span><BuyerRequestBadge status={displayedRequestStatus(request, now)} /></div><h2><Link href={`/pedido/${request.id}`}>{request.title}</Link></h2><RelativeDate date={request.created_at} /><div className="request-card-meta"><span>{request.category?.name}</span><span>Hasta {request.radius_km} km</span><span>{requestUrgencies[request.needed_when]}</span></div><p className="info-note">Vence: {new Date(request.expires_at).toLocaleString("es-AR")}</p><div className="request-card-bottom"><strong>{request.offers[0]?.count ?? 0} {(request.offers[0]?.count ?? 0) === 1 ? "oferta recibida" : "ofertas recibidas"}</strong><Link href={`/pedido/${request.id}`}>Ver pedido <ArrowRight size={15} /></Link></div></article>)}</div>
      {data.total === 0 && <div className="empty-state"><Megaphone size={28} /><h2>No hay pedidos en esta lista</h2><p>Publicá lo que necesitás para guardarlo en tu cuenta.</p><Link className="primary-button" href="/pedido/nuevo">Crear pedido</Link></div>}
      {data.total > requestsPageSize && <nav className="merchant-product-pagination" aria-label="Páginas de pedidos"><button className="outline-button" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(data.total / requestsPageSize)}</span><button className="outline-button" disabled={(page + 1) * requestsPageSize >= data.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
    </>}
  </>;
}

export function BuyerRequestDetail({ id, confirmation = false }: { id: string; confirmation?: boolean }) {
  const data = useBuyerRequests("ALL", 0, id);
  const now = useRequestClock();
  const [action, setAction] = useState<"CLOSED" | "CANCELLED" | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const request = data.requests[0];
  const status = request ? displayedRequestStatus(request, now) : null;
  async function finish() {
    if (inFlight.current || !action || !data.userId || status !== "OPEN") return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const result = await client.from("requests").update({ status: action }).eq("id", id).eq("buyer_id", data.userId).eq("status", "OPEN").gt("expires_at", new Date().toISOString()).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) { setError("El pedido cambió de estado, venció o ya no está disponible."); await data.refresh(); return; }
      setAction(null); await data.refresh();
    } catch { setError("No pudimos actualizar tu pedido. Volvé a intentar."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (data.loading) return <p className="workflow-loading" role="status">Cargando pedidos...</p>;
  if (data.error) return <section className="panel"><FormError message={data.error} /><button className="outline-button" onClick={() => void data.refresh()}>Reintentar</button></section>;
  if (!request || !status) return <UnavailableBuyerRequest />;
  if (confirmation) return <section className="workflow-narrow confirmation panel"><span className="confirmation-icon"><Check size={32} /></span><h1>¡Pedido publicado!</h1><p>Tu pedido quedó guardado en tu cuenta.</p><small>Los comercios pueden responder mientras tu pedido esté abierto. Las ofertas aparecen automáticamente en el detalle.</small><div className="confirmation-summary"><span className="eyebrow buyer-request-id">{request.id}</span><h2>{request.title}</h2><BuyerRequestFacts request={request} /><BuyerRequestBadge status={status} /></div><Link className="primary-button" href={`/pedido/${id}`}>Ver mi pedido</Link><Link className="secondary-link" href="/pedidos">Ir a Mis pedidos</Link></section>;
  return <><BackLink href="/pedidos">Volver a Mis pedidos</BackLink><LiveFeedback state={data.live} notice={data.notice} /><button className="secondary-link" onClick={() => void data.refresh()}>Actualizar pedido</button><section className="panel request-overview"><div className="card-topline"><span className="buyer-request-id">{request.id}</span><BuyerRequestBadge status={status} /></div><h1>{request.title}</h1><RelativeDate date={request.created_at} /><p className="request-description">{request.description || "No agregaste una descripción."}</p><BuyerRequestFacts request={request} />
    {status === "EXPIRED" && <p className="info-note">Este pedido expiró. Podés crear uno nuevo si todavía lo necesitás.</p>}
    {status === "OPEN" && <div className="request-actions"><button disabled={busy} onClick={() => { setError(""); setAction("CLOSED"); }}>Cerrar pedido</button><button disabled={busy} onClick={() => { setError(""); setAction("CANCELLED"); }}>Cancelar pedido</button></div>}
    </section><BuyerOfferList key={`${data.userId}:${id}`} requestId={id} />
    {action && <Dialog title={action === "CLOSED" ? "Cerrar pedido" : "Cancelar pedido"} onClose={() => { if (!busy) setAction(null); }}><div className="dialog-body text-dialog"><h2>{action === "CLOSED" ? "¿Cerrar este pedido?" : "¿Cancelar este pedido?"}</h2><p>Se conservará en Mis pedidos. Podés crear otro cuando lo necesites.</p>{status !== "OPEN" && <p className="info-note">Este pedido ya no está abierto.</p>}<FormError message={error} /><div className="dialog-actions"><button className="primary-button" disabled={busy || status !== "OPEN"} onClick={() => void finish()}>{busy ? "Guardando..." : action === "CLOSED" ? "Cerrar pedido" : "Cancelar pedido"}</button><BackButton disabled={busy} onClick={() => setAction(null)}>Volver</BackButton></div></div></Dialog>}
  </>;
}



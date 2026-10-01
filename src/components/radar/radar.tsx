"use client";

import { useEffect, useRef, useState } from "react";
import { Flame, Lightbulb, Radio, Zap } from "lucide-react";
import Link from "next/link";
import type { BusinessRow } from "@/types/database";
import { filterRealRadar, realOpportunities, type RealRadarFilter, type RealRadarDistanceFilter, type RealRadarOrder } from "@/lib/real-radar";
import { isCoordinates } from "@/lib/location";
import { MerchantBusinessGate } from "../merchant-products/business-gate";
import { useLiveRadar } from "./use-live-radar";
import { LiveFeedback, useLiveNotice } from "../requests/use-live-changes";
import { useRequestClock } from "../requests/buyer-request-common";
import { FormError } from "../requests/request-common";
import { OpportunityCard } from "./opportunity-card";

export function Radar() {
  return <MerchantBusinessGate>{business => business.active ? <BusinessRadar key={business.id} business={business} /> : <section className="empty-state"><h1>Tu comercio está inactivo</h1><p>Necesitás un comercio activo para ver oportunidades y enviar ofertas.</p></section>}</MerchantBusinessGate>;
}
function BusinessRadar({ business }: { business: BusinessRow }) {
  const data = useLiveRadar(business.id, undefined, business.updated_at);
  const { notice, show } = useLiveNotice();
  const previous = useRef<{ userId?: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    if (!data.data) return;
    const ids = new Set(data.data.requests.map(row => row.id));
    if (previous.current && previous.current.userId === data.userId) {
      const added = data.data.requests.find(row => !previous.current?.ids.has(row.id));
      if (added) show(`🔥 Nueva oportunidad: ${added.title}`);
      else if ([...previous.current.ids].some(id => !ids.has(id))) show("Un pedido ya no acepta ofertas.");
    }
    previous.current = { userId: data.userId, ids };
  }, [data.data, data.userId, show]);
  const [filter, setFilter] = useState<RealRadarFilter>("all");
  const [order, setOrder] = useState<RealRadarOrder>("recent");
  const [distanceFilter, setDistanceFilter] = useState<RealRadarDistanceFilter>("all");
  const now = useRequestClock();
  const opportunities = data.data ? realOpportunities(data.data, business, now) : [];
  const hasLocation = isCoordinates(business);
  const hasDistances = hasLocation && opportunities.some(row => row.request.distance_km !== null);
  const activeDistanceFilter = hasDistances ? distanceFilter : "all";
  const activeOrder = !hasDistances && order === "distance" ? "recent" : order;
  const visible = filterRealRadar(opportunities, filter, activeOrder, activeDistanceFilter);
  const demand = new Map<string, { name: string; count: number }>();
  for (const { request } of opportunities) {
    const item = demand.get(request.category_id);
    demand.set(request.category_id, { name: request.category_name, count: (item?.count ?? 0) + 1 });
  }
  const filters: [RealRadarFilter, string][] = [["all", "Todos"], ["today", "Necesita hoy"], ["catalog", "Coincide con mi catálogo"]];
  const distanceFilters: [RealRadarDistanceFilter, string][] = [["all", "Cualquier distancia"], ["5", "Menos de 5 km"], ["10", "Menos de 10 km"], ["radius", "Dentro del radio solicitado"]];
  return <><div className="workflow-heading with-action"><div><span className="eyebrow">{business.name}</span><h1><Radio className="radar-heading-icon" size={30} aria-hidden="true" />Radar CercaYa</h1><p>Pedidos abiertos que podrías resolver con tu comercio.</p></div><button className="outline-button" disabled={data.busy} onClick={() => void data.refresh()}>{data.busy ? "Actualizando..." : "Actualizar"}</button></div>
    <p className="info-note">Los pedidos con ubicación sólo aparecen si tu comercio está dentro del radio solicitado. Los pedidos sin ubicación se muestran por categoría, sin afirmar cercanía. Las distancias son aproximadas, en línea recta; no compartimos coordenadas del comprador.</p>
    {!hasLocation && <section className="panel"><p>Configurá la ubicación de tu comercio para ver oportunidades según cercanía.</p><Link className="outline-button" href="/comercio/editar">Configurar ubicación</Link></section>}
    <LiveFeedback state={data.live} notice={notice} />
    {data.loading && <p className="workflow-loading" role="status">Cargando oportunidades...</p>}<FormError message={data.error} />
    {!data.loading && !data.error && <><dl className="radar-metrics" aria-label="Resumen de pedidos abiertos"><div><dt><Radio size={18} aria-hidden="true" />Oportunidades abiertas</dt><dd>{opportunities.length}</dd></div><div><dt><Zap size={18} aria-hidden="true" />Para hoy</dt><dd>{opportunities.filter(row => row.request.needed_when === "TODAY").length}</dd></div><div><dt><Lightbulb size={18} aria-hidden="true" />Coinciden con tu catálogo</dt><dd>{opportunities.filter(row => row.product).length}</dd></div><div><dt><Flame size={18} aria-hidden="true" />Todavía sin ofertas</dt><dd>{opportunities.filter(row => row.request.offers_count === 0).length}</dd></div></dl>
    <div className="request-tabs" role="group" aria-label="Filtros del Radar">{filters.map(([value, label]) => <button key={value} className={`filter-chip ${filter === value ? "selected" : ""}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <div className="request-tabs" role="group" aria-label="Filtros de distancia del Radar">{distanceFilters.map(([value, label]) => <button key={value} className={`filter-chip ${activeDistanceFilter === value ? "selected" : ""}`} aria-pressed={activeDistanceFilter === value} disabled={value !== "all" && !hasDistances} title={value !== "all" && !hasDistances ? "Necesitás oportunidades con distancia disponible." : undefined} onClick={() => setDistanceFilter(value)}>{label}</button>)}</div>
    {!hasDistances && <p className="info-note">Los filtros de distancia y Más cerca se habilitan cuando hay pedidos con distancia disponible.</p>}
    <div className="offers-heading radar-toolbar"><p role="status">{visible.length} de {opportunities.length} oportunidades</p><label>Ordenar<select value={activeOrder} onChange={event => setOrder(event.target.value === "distance" ? "distance" : event.target.value === "urgent" ? "urgent" : "recent")}><option value="recent">Más recientes</option><option value="urgent">Urgencia</option><option value="distance" disabled={!hasDistances}>Más cerca</option></select></label></div>
    <p className="info-note">{activeOrder === "distance" ? "Ordenamos por distancia; los pedidos sin distancia quedan al final." : "Primero tus categorías; dentro de cada grupo se aplica el orden elegido."} Las métricas incluyen todas las oportunidades permitidas para tu comercio, antes de estos filtros.</p>
    <div className="request-list-grid">{visible.map(opportunity => <OpportunityCard key={opportunity.request.id} opportunity={opportunity} />)}</div>
    {!visible.length && <section className="empty-state"><Radio size={30} /><h2>{opportunities.length ? "No hay oportunidades con este filtro" : "Todavía no hay oportunidades disponibles"}</h2><p>Los nuevos pedidos aparecen automáticamente. También podés usar Actualizar.</p>{(filter !== "all" || activeDistanceFilter !== "all") && <button className="outline-button" onClick={() => { setFilter("all"); setDistanceFilter("all"); }}>Ver todos</button>}</section>}
    <section className="panel radar-demand"><h2>Qué están buscando</h2><p className="info-note">Oportunidades permitidas para tu comercio, agrupadas por categoría. Incluye pedidos sin ubicación.</p>{demand.size ? <ul>{[...demand.entries()].sort((a, b) => b[1].count - a[1].count).map(([id, item]) => <li key={id}><strong>{item.name}</strong><span>{item.count} {item.count === 1 ? "búsqueda" : "búsquedas"}</span></li>)}</ul> : <p className="info-note">Todavía no hay búsquedas abiertas para agrupar.</p>}</section></>}
  </>;
}



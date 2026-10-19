"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { BackLink } from "@/components/navigation/back-link";
import { readMyServiceRequests, readServiceRadar, readServiceRequestOffers } from "@/lib/service-radar/client";
import { readMyServiceProvider, readMyServiceListings, readServiceCategories } from "@/lib/services/client";
import { providerPublishProblem } from "@/lib/services/frontend";
import { isServiceId } from "@/lib/services/contracts";
import { provinceByCode } from "@/lib/argentina-provinces";
import { radarPage, radarReturnTo, setRadarParams } from "@/lib/service-radar/navigation";
import type { ServiceRequestView, ServiceRadarOpportunity } from "@/types/service-radar";
import { dateLabel, requestIsOpen, offerLabels, radarClient, requestLabels, useRadarQuery, useExpiryRefresh, RadarFeedback, RadarPagination } from "./radar-common";
import {ProposalBudget} from "./proposal-budget";
import styles from "./service-radar.module.css";

export function RequestCard({ row, opportunity = false, returnTo }: { row: ServiceRequestView | ServiceRadarOpportunity; opportunity?: boolean; returnTo: string }) {
 const accepts = requestIsOpen(row);
 const visibleStatus = row.status === "OPEN" ? accepts ? opportunity ? "Acepta propuestas" : "Buscando profesionales" : Date.parse(row.expires_at) <= Date.now() ? "Solicitud vencida" : "No disponible para propuestas" : requestLabels[row.status];
 const href = opportunity ? `/radar-servicios/${row.id}` : `/solicitud-servicio/${row.id}`;
 return <article className={styles.card}><span className={styles.context}>{opportunity?"Oportunidad profesional":"Tu solicitud de trabajo"}</span><span className={styles.badge} data-status={row.status==="OPEN"&&!accepts?Date.parse(row.expires_at)<=Date.now()?"EXPIRED":"UNAVAILABLE":row.status}>{visibleStatus}</span><h2>{row.title}</h2><p>{row.category_name}</p><p>{row.city}, {provinceByCode(row.province_code)?.name}</p><p className={styles.description}>{row.description.length > 180 ? `${row.description.slice(0,180)}…` : row.description}</p><p className={styles.meta}>Publicado: {dateLabel(row.created_at)} · Vence: {dateLabel(row.expires_at)}</p>{"my_offer_id" in row && row.my_offer_id && <p className={styles.meta}>Ya enviaste una propuesta</p>}<Link className="outline-button" href={`${href}?returnTo=${encodeURIComponent(returnTo)}`}>{opportunity ? "Ver solicitud" : "Ver detalle y propuestas"}</Link></article>;
}
export function MyServiceRequests() {
 const params = useSearchParams(), page = radarPage(new URLSearchParams(params.toString()));
 const load = useCallback((signal: AbortSignal) => readMyServiceRequests(radarClient(), { page, pageSize: 12 }, signal), [page]);
 const resource = useRadarQuery(`my-requests:${page}`, load);
 useExpiryRefresh(resource.data?.items.filter(row => row.status === "OPEN").map(row => row.expires_at) ?? [], resource.reload);
 const returnTo = radarReturnTo(`/mis-solicitudes-servicio?${params}`);
 return <div className={styles.experience}><BackLink href="/cuenta">Mi cuenta</BackLink><div className={styles.title}><h1>Mis solicitudes de servicios</h1><p>Seguí los trabajos que pediste y las propuestas recibidas.</p><div className={styles.actions}><Link className="primary-button" href="/necesito-un-servicio">Necesito un servicio</Link><button className="outline-button" onClick={resource.reload}>Actualizar solicitudes</button></div></div><RadarFeedback {...resource} retry={resource.reload}/>{resource.data && <><p className={styles.meta}>{resource.data.total} solicitudes</p><div className={styles.grid}>{resource.data.items.map(row => <RequestCard key={row.id} row={row} returnTo={returnTo}/>)}</div>{!resource.data.total && <p className={styles.notice}>Todavía no publicaste solicitudes. Contá qué trabajo necesitás y en qué localidad.</p>}<RadarPagination page={page} total={resource.data.total} onPage={value => setRadarParams({ page: String(value) })}/></>}</div>;
}

export function ServiceRadarList() {
 const params = useSearchParams(), page = radarPage(new URLSearchParams(params.toString())), category = params.get("category") ?? "";
 const loadWorkspace = useCallback(async (signal: AbortSignal) => {
   const client = radarClient(); const [provider,categories,services] = await Promise.all([readMyServiceProvider(client),readServiceCategories(client,signal),readMyServiceListings(client,{ status: "PUBLISHED",pageSize: 50 },signal)]);
   return { provider,categories,services };
 }, []);
 const workspace = useRadarQuery("radar-workspace", loadWorkspace);
 const provider = workspace.data?.provider;
 const problem = workspace.data ? !provider ? "Creá tu perfil profesional para comenzar a recibir oportunidades." : !provider.areas.length ? "Agregá las localidades donde trabajás para recibir oportunidades." : providerPublishProblem(provider) || (!workspace.data.services.items.some(item => !item.admin_blocked && item.accepting_inquiries) ? "Publicá al menos un servicio habilitado que acepte consultas para comenzar a recibir oportunidades." : "") : "";
 const validCategory = !category || (isServiceId(category) && workspace.data?.categories.some(item => item.id === category && item.parent_id));
 const load = useCallback((signal: AbortSignal) => readServiceRadar(radarClient(), { categoryId: category || null, page, pageSize: 12 }, signal), [category,page]);
 const resource = useRadarQuery(`radar:${category}:${page}`,load,!!workspace.data && !problem && !!validCategory);
 useExpiryRefresh(resource.data?.items.map(row => row.expires_at) ?? [],resource.reload);
 const returnTo = radarReturnTo(`/radar-servicios?${params}`,"/radar-servicios");
 return <div className={styles.experience}><BackLink href="/cuenta">Mi cuenta</BackLink><div className={styles.title}><span className={styles.context}>RADAR DE SERVICIOS</span><h1>Trabajos que podés realizar</h1><p>Estas solicitudes coinciden con tus servicios y las localidades donde trabajás.</p><p className={styles.meta}>Ves solicitudes de las localidades donde ofrecés tus servicios. No usamos tu residencia ni calculamos distancias.</p><Link className="secondary-link" href="/mi-perfil-profesional#professional-coverage">Revisar mi cobertura</Link></div><div className={styles.actions}><button className="outline-button" onClick={() => { workspace.reload(); resource.reload(); }}>Actualizar oportunidades</button><Link className="outline-button" href="/mis-propuestas-servicio">Mis propuestas</Link></div><RadarFeedback loading={workspace.loading || resource.loading} error={workspace.error || resource.error} retry={() => { workspace.reload(); resource.reload(); }}/>{problem && <div className={styles.notice}><p>{problem}</p><div className={styles.actions}><Link className="outline-button" href="/mi-perfil-profesional">Mi perfil profesional</Link><Link className="outline-button" href="/mis-servicios">Mis servicios</Link></div></div>}
   {workspace.data && <label className={styles.field}>Especialidad exacta<select value={category} onChange={event => setRadarParams({ category: event.target.value,page: "0" })}><option value="">Todas las oportunidades compatibles</option>{category && !validCategory && <option value={category}>Especialidad no disponible</option>}{workspace.data.categories.filter(item => item.parent_id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
   {!validCategory && workspace.data && <p className={styles.notice}>Elegí una especialidad disponible para consultar el Radar.</p>}{resource.data && <><p className={styles.meta}>{resource.data.total} oportunidades</p><div className={styles.grid}>{resource.data.items.map(row => <RequestCard key={row.id} row={row} opportunity returnTo={returnTo}/>)}</div>{!resource.data.total && <p className={styles.notice}>Por ahora no hay trabajos que coincidan con tus servicios. Podés actualizar más tarde o revisar tu cobertura.</p>}<RadarPagination page={page} total={resource.data.total} onPage={value => setRadarParams({ page: String(value) })}/></>}</div>;
}

export function MyServiceProposals() {
 const params = useSearchParams(),page = radarPage(new URLSearchParams(params.toString()));
 const load = useCallback((signal: AbortSignal) => readServiceRequestOffers(radarClient(), { seller: true,page,pageSize: 12 },signal), [page]);
 const resource = useRadarQuery(`my-proposals:${page}`,load);
 useExpiryRefresh(resource.data?.items.filter(row => row.request.status === "OPEN").map(row => row.request.expires_at) ?? [],resource.reload);
 const returnTo = radarReturnTo(`/mis-propuestas-servicio?${params}`,"/mis-propuestas-servicio");
 return <div className={styles.experience}><BackLink href="/cuenta">Mi cuenta</BackLink><div className={styles.title}><h1>Mis propuestas</h1><p>Consultá los presupuestos que enviaste y seguí sus respuestas.</p></div><div className={styles.actions}><Link className="primary-button" href="/radar-servicios">Radar de servicios</Link><button className="outline-button" onClick={resource.reload}>Actualizar propuestas</button></div><RadarFeedback {...resource} retry={resource.reload}/>{resource.data && <><p className={styles.meta}>{resource.data.total} propuestas</p><div className={styles.grid}>{resource.data.items.map(row => <article className={styles.card} key={row.id}><span className={styles.badge} data-status={row.status}>{offerLabels[row.status]}</span><h2>{row.request.title}</h2><p>{row.request.city}, {provinceByCode(row.request.province_code)?.name}</p><ProposalBudget mode={row.pricing_mode} price={row.proposed_price}/><p className={styles.description}>{row.message}</p><p className={styles.meta}>Enviada: {dateLabel(row.created_at)} · {requestLabels[row.request.status]}</p><Link className="secondary-link" href={`/mis-servicios/${row.service_listing_id}`}>Ver servicio utilizado</Link><Link className="outline-button" href={`/mis-propuestas-servicio/${row.id}?returnTo=${encodeURIComponent(returnTo)}`}>Ver propuesta e historial</Link></article>)}</div>{!resource.data.total && <p className={styles.notice}>Todavía no enviaste propuestas. Explorá las oportunidades compatibles con tus servicios.</p>}<RadarPagination page={page} total={resource.data.total} onPage={value => setRadarParams({ page: String(value) })}/></>}</div>;
}

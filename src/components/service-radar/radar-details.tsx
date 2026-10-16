"use client";

import Link from "next/link";
import { useCallback,useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { BackLink } from "@/components/navigation/back-link";
import { readMyServiceRequests,readServiceRadar,readServiceRequestOffers } from "@/lib/service-radar/client";
import { readMyServiceListing } from "@/lib/services/client";
import { servicePriceLabel } from "@/lib/services/frontend";
import { provinceByCode } from "@/lib/argentina-provinces";
import { argentinaWhatsAppUrl } from "@/lib/phone";
import { radarPage,radarReturnTo,setRadarParams } from "@/lib/service-radar/navigation";
import type { ServiceRequestView,ServiceRequestOfferView } from "@/types/service-radar";
import { RadarConfirm,type RadarAction } from "./radar-confirm";
import { RadarReport } from "./radar-report";
import { ProposalEditor } from "./proposal-editor";
import { dateLabel,offerLabels,requestLabels,requestIsOpen,radarClient,useRadarQuery,useExpiryRefresh,RadarFeedback,RadarPagination } from "./radar-common";
import styles from "./service-radar.module.css";

function RequestPresentation({ row }: { row: ServiceRequestView }) {
 return <section className={styles.panel}><span className={styles.badge}>{requestLabels[row.status]}</span><h1>{row.title}</h1><p>{row.category_name}</p><p>{row.city}, {provinceByCode(row.province_code)?.name}</p><p className={styles.description}>{row.description}</p><p className={styles.meta}>Publicado: {dateLabel(row.created_at)} · Vence: {dateLabel(row.expires_at)}</p><p className={styles.meta}>Sólo se muestra la localidad. La dirección precisa se coordina en privado con el profesional elegido.</p>{!row.available && row.status === "OPEN" && <p>Esta solicitud no está disponible actualmente para recibir propuestas.</p>}</section>;
}

export function ServiceOpportunity({ id }: { id: string }) {
 const params = useSearchParams(),returnTo = radarReturnTo(params.get("returnTo"),"/radar-servicios");
 const load = useCallback(async (signal: AbortSignal) => (await readServiceRadar(radarClient(),{ requestId: id,pageSize: 1 },signal)).items[0] ?? null,[id]);
 const resource = useRadarQuery(`opportunity:${id}`,load);
 useExpiryRefresh(resource.data ? [resource.data.expires_at] : [],resource.reload);
 return <><BackLink href={returnTo}>Volver al Radar</BackLink><div className={styles.actions}><button className="outline-button" onClick={resource.reload}>Actualizar oportunidad</button><Link className="outline-button" href="/mis-propuestas-servicio">Mis propuestas</Link></div><RadarFeedback {...resource} retry={resource.reload}/>{!resource.loading && !resource.error && !resource.data && <section className={styles.panel}><h1>Esta oportunidad ya no está disponible para tu perfil</h1><p>Puede haber vencido, haberse cerrado o haber cambiado tu cobertura o habilitación.</p><Link href="/mi-perfil-profesional">Revisar mi perfil profesional</Link></section>}{resource.data && <><RequestPresentation row={resource.data}/>{resource.data.my_offer_id ? <div className={styles.notice}><p>Ya enviaste una propuesta. Podés consultar su estado y administrarla.</p><Link className="primary-button" href={`/mis-propuestas-servicio/${resource.data.my_offer_id}?returnTo=${encodeURIComponent(returnTo)}`}>Ver mi propuesta</Link></div> : requestIsOpen(resource.data) && <ProposalEditor requestId={id} categoryId={resource.data.category_id} returnTo={returnTo} onRefresh={resource.reload}/>}<RadarReport entity="request" id={id}/></>}</>;
}

export function BuyerServiceRequest({ id }: { id: string }) {
 const params = useSearchParams(),returnTo = radarReturnTo(params.get("returnTo"));
 const pageParams = new URLSearchParams(); pageParams.set("page",params.get("offer_page") ?? "0"); const page = radarPage(pageParams);
 const load = useCallback(async (signal: AbortSignal) => {
   const client = radarClient(); const requests = await readMyServiceRequests(client,{ requestId: id,pageSize: 1 },signal);
   const row = requests.items[0] ?? null;
   if (!row) return { row,offers: null,selected: null };
   const offers = await readServiceRequestOffers(client,{ requestId: id,page,pageSize: 12 },signal);
   const selected = row.selected_offer_id ? offers.items.find(item => item.id === row.selected_offer_id)
     ?? (await readServiceRequestOffers(client,{ requestId: id,offerId: row.selected_offer_id,pageSize: 1 },signal)).items[0] ?? null : null;
   return { row,offers,selected };
 },[id,page]);
 const resource = useRadarQuery(`buyer-request:${id}:${page}`,load);
 const [confirmation,setConfirmation] = useState<{ action: RadarAction; offer?: ServiceRequestOfferView } | null>(null);
 const [expiryConfirmed,setExpiryConfirmed] = useState(false);
 const [expiryIndeterminate,setExpiryIndeterminate] = useState(false);
 useExpiryRefresh(resource.data?.row?.status === "OPEN" ? [resource.data.row.expires_at] : [],resource.reload);
 const row = resource.data?.row;
 const closeDialog = () => { setConfirmation(null); resource.reload(); };
 return <><BackLink href={returnTo}>Mis solicitudes de servicios</BackLink><div className={styles.actions}><button className="outline-button" onClick={resource.reload}>Actualizar propuestas</button></div><RadarFeedback {...resource} retry={resource.reload}/>{resource.data && !row && <p className={styles.notice}>Esta solicitud no está disponible para tu cuenta.</p>}{row && resource.data?.offers && <>
   <RequestPresentation row={row}/>
   {requestIsOpen(row) && <div className={styles.actions}>{resource.data.offers.total === 0 ? <Link className="outline-button" href={`/solicitud-servicio/${id}/editar?returnTo=${encodeURIComponent(returnTo)}`}>Editar solicitud</Link> : <p className={styles.meta}>Esta solicitud ya recibió propuestas. Para cambiar las condiciones, cerrala o cancelala y publicá una nueva.</p>}<button className="outline-button" onClick={() => setConfirmation({ action: "close" })}>Cerrar sin elegir profesional</button><button className="outline-button" onClick={() => setConfirmation({ action: "cancel" })}>Cancelar solicitud</button></div>}
   {row.status === "EXPIRED" && <div className={styles.notice}><p>Esta solicitud venció y ya no acepta propuestas. Su historial se conserva; no puede extenderse ni reabrirse.</p>{expiryIndeterminate && <p role="status">La actualización adicional del vencimiento sigue indeterminada. Ver este estado no confirma que se haya guardado ese cambio; no se reintentará automáticamente.</p>}{!expiryConfirmed && <button className="outline-button" onClick={() => setConfirmation({ action: "expire" })}>Confirmar solicitud vencida</button>}</div>}
   {row.status === "CLOSED" && !row.selected_offer_id && <p className={styles.notice}>Cerraste la solicitud sin elegir un profesional.</p>}
   {resource.data.selected && <section className={`${styles.panel} ${styles.selected}`}><h2>Profesional elegido</h2><p>Elegiste a este profesional. Ahora podés comunicarte para coordinar el trabajo.</p><p className={styles.meta}>La elección no implica que el trabajo se haya realizado ni pagado.</p><ReceivedProposal offer={resource.data.selected} selected onAction={action => setConfirmation({ action,offer: resource.data!.selected! })}/></section>}
   <section className={styles.stack} aria-labelledby="received-proposals"><h2 id="received-proposals">Propuestas recibidas</h2><p className={styles.meta}>{resource.data.offers.total} propuestas · Compará el alcance y los mensajes, además del precio.</p><div className={styles.grid}>{resource.data.offers.items.map(offer => <ReceivedProposal key={offer.id} offer={offer} canChoose={requestIsOpen(row)} onAction={action => setConfirmation({ action,offer })}/>)}</div>{!resource.data.offers.total && <p className={styles.notice}>Todavía no recibiste propuestas. Los profesionales compatibles podrán encontrar tu solicitud mientras esté vigente.</p>}<RadarPagination page={page} total={resource.data.offers.total} onPage={value => setRadarParams({ offer_page: String(value) })}/></section>
   {confirmation && <RadarConfirm key={`${confirmation.action}:${confirmation.offer?.id ?? id}`} action={confirmation.action} request={row} offer={confirmation.offer} onClose={closeDialog} onIndeterminate={() => setExpiryIndeterminate(true)} onConfirmed={() => { if(confirmation.action === "expire"){setExpiryConfirmed(true);setExpiryIndeterminate(false);}closeDialog(); }}/>}
   <Link className="secondary-link" href={`/necesito-un-servicio?returnTo=${encodeURIComponent(returnTo)}`}>Publicar otra necesidad</Link>
 </>}</>;
}

function ReceivedProposal({ offer,canChoose = false,selected = false,onAction }: { offer: ServiceRequestOfferView; canChoose?: boolean; selected?: boolean; onAction: (action: "accept" | "reject") => void }) {
 const whatsapp = selected && offer.status === "ACCEPTED" && offer.available && offer.contact_whatsapp ? argentinaWhatsAppUrl(offer.contact_whatsapp,`Hola, soy quien publicó la solicitud ${offer.request.title} en CercaYa. Elegí tu propuesta y quería coordinar los detalles del trabajo.`) : null;
 return <article className={styles.card}><span className={styles.badge}>{offer.status === "ACCEPTED" ? "Propuesta elegida" : offer.status === "PENDING" ? "Propuesta recibida" : offerLabels[offer.status]}</span><h3>{offer.provider_name}</h3><p className={styles.meta}>{offer.pricing_mode === "FIXED" ? "Precio fijo" : offer.pricing_mode === "FROM" ? "Precio desde" : "Presupuesto a coordinar"}</p><strong className={styles.price}>{servicePriceLabel(offer.pricing_mode,offer.proposed_price)}</strong><p className={styles.description}>{offer.message}</p><p className={styles.meta}>{offer.available ? "Servicio habilitado actualmente" : "Esta propuesta no está disponible actualmente para elegir"}</p><div className={styles.actions}>{offer.provider_available && <Link className="outline-button" href={`/prestador/${offer.provider_id}`}>Ver perfil profesional</Link>}<Link className="secondary-link" href={`/servicio/${offer.service_listing_id}`}>Ver servicio asociado</Link></div>{canChoose && offer.status === "PENDING" && <div className={styles.actions}><button className="primary-button" disabled={!offer.available} onClick={() => onAction("accept")}>Elegir este profesional</button><button className="outline-button" onClick={() => onAction("reject")}>Rechazar propuesta</button></div>}{selected && (whatsapp ? <a href={whatsapp} className="primary-button" target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true"/>Contactar por WhatsApp</a> : <p className={styles.notice}>El contacto no está disponible actualmente. Podés volver a actualizar esta pantalla.</p>)}<RadarReport entity="offer" id={offer.id}/></article>;
}

export function MyServiceProposal({ id }: { id: string }) {
 const params = useSearchParams(),returnTo = radarReturnTo(params.get("returnTo"),"/mis-propuestas-servicio");
 const load = useCallback(async (signal: AbortSignal) => {
   const client = radarClient(),offer = (await readServiceRequestOffers(client,{ seller: true,offerId: id,pageSize: 1 },signal)).items[0] ?? null;
   if (!offer) return { offer,serviceTitle: null };
   let serviceTitle: string | null = null;
   try { serviceTitle = (await readMyServiceListing(client,offer.service_listing_id))?.title ?? null; } catch { /* history is usable without a current service title */ }
   return { offer,serviceTitle };
 },[id]);
 const resource = useRadarQuery(`my-proposal:${id}`,load),[editing,setEditing] = useState(false),[withdraw,setWithdraw] = useState(false);
 useExpiryRefresh(resource.data?.offer?.request.status === "OPEN" ? [resource.data.offer.request.expires_at] : [],resource.reload);
 const offer = resource.data?.offer;
 const closeDialog = () => { setWithdraw(false); setEditing(false); resource.reload(); };
 return <><BackLink href={returnTo}>Volver</BackLink><div className={styles.actions}><button className="outline-button" onClick={resource.reload}>Actualizar propuesta</button></div><RadarFeedback {...resource} retry={resource.reload}/>{resource.data && !offer && <p className={styles.notice}>Esta propuesta no está disponible para tu cuenta.</p>}{offer && <>
   <RequestPresentation row={offer.request}/><section className={styles.panel}><h2>Tu propuesta</h2><span className={styles.badge}>{offerLabels[offer.status]}</span><Link className="secondary-link" href={`/mis-servicios/${offer.service_listing_id}`}>{resource.data?.serviceTitle ?? "Ver servicio utilizado"}</Link><strong className={styles.price}>{servicePriceLabel(offer.pricing_mode,offer.proposed_price)}</strong><p className={styles.description}>{offer.message}</p><p className={styles.meta}>Enviada: {dateLabel(offer.created_at)}</p>{offer.status === "ACCEPTED" && <p className={styles.notice}>Tu propuesta fue elegida. El vecino puede iniciar el contacto usando tu WhatsApp público autorizado. CercaYa no comparte su teléfono automáticamente ni confirma que el trabajo esté realizado o pagado.</p>}{offer.status === "PENDING" && <div className={styles.actions}>{offer.available && requestIsOpen(offer.request) && <button className="outline-button" onClick={() => setEditing(value => !value)}>{editing ? "Ocultar edición" : "Editar propuesta"}</button>}<button className="outline-button" onClick={() => setWithdraw(true)}>Retirar propuesta</button></div>}{offer.status !== "PENDING" && <p className={styles.meta}>Historial de sólo lectura. Las propuestas resueltas no se reactivan.</p>}</section>
   {editing && offer.status === "PENDING" && offer.available && requestIsOpen(offer.request) && <ProposalEditor requestId={offer.request_id} categoryId={offer.request.category_id} initial={offer} returnTo={returnTo} onRefresh={() => { setEditing(false); resource.reload(); }}/>}
   {offer.status === "PENDING" && !requestIsOpen(offer.request) && <p className={styles.notice}>Este trabajo ya no acepta propuestas. Aunque la tuya siga esperando respuesta en el historial, no puede ser elegida.</p>}
   <RadarReport entity="request" id={offer.request_id}/>{withdraw && <RadarConfirm action="withdraw" request={offer.request} offer={offer} onClose={closeDialog} onConfirmed={closeDialog}/>}
 </>}</>;
}

"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { readMyServiceListings } from "@/lib/services/client";
import { assertServiceSession, servicePrice } from "@/lib/services/frontend";
import { readServiceRequestOffers, readServiceRadar, saveMyServiceRequestOffer } from "@/lib/service-radar/client";
import { offerMatches, parseOfferDraft, type OfferDraft } from "@/lib/service-radar/frontend";
import type { ServiceRequestOfferView } from "@/types/service-radar";
import { radarClient, radarUiError, requestIsOpen, useRadarQuery, useRadarDraft, RadarFeedback, RadarDraftProblem } from "./radar-common";
import styles from "./service-radar.module.css";

export function ProposalEditor({ requestId, categoryId, initial, returnTo, onRefresh }: { requestId: string; categoryId: string; initial?: ServiceRequestOfferView; returnTo: string; onRefresh: () => void }) {
 const { user } = useAuth(), router = useRouter();
 const load = useCallback((signal: AbortSignal) => readMyServiceListings(radarClient(), { status: "PUBLISHED", pageSize: 50 }, signal), []);
 const services = useRadarQuery(`proposal-services:${requestId}`,load);
 const eligible = services.data?.items.filter(item => item.category_id === categoryId && item.accepting_inquiries && !item.admin_blocked && !item.provider.admin_blocked && item.provider.active) ?? [];
 const complete = !!services.data && services.data.total === services.data.items.length;
 const store = useRadarDraft<OfferDraft>(`cercaya.service-radar.offer.${user?.id}.${requestId}`, () => ({ id: initial?.id ?? crypto.randomUUID(), requestId,
   listingId: initial?.service_listing_id ?? "", message: initial?.message ?? "", mode: initial?.pricing_mode ?? "QUOTE", price: initial?.proposed_price?.toString() ?? "", baseRevision: initial?.revision ?? null, uncertain: false }),
   value => { const parsed = parseOfferDraft(value); return parsed && parsed.requestId === requestId && (!initial || parsed.id === initial.id) ? parsed : null; });
 const draft = store.draft, [busy,setBusy] = useState(false), [error,setError] = useState(""), [remoteChanged,setRemoteChanged] = useState(false), lock = useRef(false), mounted = useRef(true);
 const live = useCallback((node: HTMLDivElement | null) => { mounted.current = !!node; },[]);
 const conflict = remoteChanged || (!!initial && draft?.baseRevision !== initial.revision);
 function patch(value: Partial<OfferDraft>) { if (draft) store.update({ ...draft,...value }); }
 function confirmed(row: ServiceRequestOfferView) { if (mounted.current) { store.clear(); onRefresh(); router.replace(`/mis-propuestas-servicio/${row.id}?returnTo=${encodeURIComponent(returnTo)}`); } }
 async function verify() {
   if (!draft || lock.current) return; lock.current = true; setBusy(true); setError("");
   try {
     const client = radarClient(); await assertServiceSession(client,user?.id ?? "");
     const row = (await readServiceRequestOffers(client,{ seller: true,offerId: draft.id,pageSize: 1 })).items[0];
     if (!mounted.current) return;
     const price = draft.mode === "QUOTE" ? null : servicePrice(draft.price);
     if (row && offerMatches(row,draft,price)) { confirmed(row); return; }
     store.update({ ...draft,uncertain: false });
     if (row && row.revision !== draft.baseRevision) setRemoteChanged(true);
     setError(row && row.revision !== draft.baseRevision ? "La información cambió. Conservamos tu mensaje; revisá la propuesta guardada." : "No encontramos el cambio confirmado. Podés revisar y volver a intentar.");
   } catch (cause) { if (mounted.current) setError(radarUiError(cause)); }
   finally { lock.current = false; if (mounted.current) setBusy(false); }
 }
 async function save() {
   if (!draft || lock.current || draft.uncertain || conflict) return;
   const price = draft.mode === "QUOTE" ? null : servicePrice(draft.price);
   if (draft.message.trim().length < 10 || draft.message.length > 1500 || !eligible.some(item => item.id === draft.listingId) || !complete || (draft.mode !== "QUOTE" && price === null)) { setError("Revisá el servicio, el mensaje y el importe del presupuesto."); return; }
   lock.current = true; setBusy(true); setError(""); store.update({ ...draft,uncertain: true });
   try {
     const client = radarClient(); await assertServiceSession(client,user?.id ?? "");
     const before = (await readServiceRequestOffers(client,{ seller: true,requestId,pageSize: 1 })).items[0];
     if (before && draft.baseRevision === null) {
       if (offerMatches(before,draft,price)) { confirmed(before); return; }
       throw new Error("Ya tenés una propuesta para esta solicitud. Revisá Mis propuestas antes de continuar.");
     }
     if (initial && (!before || before.id !== draft.id || before.revision !== draft.baseRevision || before.status !== "PENDING")) throw new Error("La información cambió. Volvé a cargar antes de continuar.");
     const opportunity = (await readServiceRadar(client,{ requestId,pageSize: 1 })).items[0];
     if (!opportunity || !requestIsOpen(opportunity)) throw new Error("Este trabajo ya no acepta propuestas de tu perfil.");
     await assertServiceSession(client,user?.id ?? ""); if (!mounted.current) return;
     await saveMyServiceRequestOffer(client,draft.id,requestId,draft.listingId,{ message: draft.message,pricing_mode: draft.mode,proposed_price: price },draft.baseRevision);
     const row = (await readServiceRequestOffers(client,{ seller: true,offerId: draft.id,pageSize: 1 })).items[0];
     if (!row || !offerMatches(row,draft,price)) throw new Error("No pudimos confirmar el presupuesto guardado. Verificá su estado.");
     confirmed(row);
   } catch (cause) { if (mounted.current) { if (cause instanceof Error && cause.message.startsWith("La información cambió")) setRemoteChanged(true); setError(`${radarUiError(cause)} Conservamos tu propuesta; verificá el estado guardado antes de reintentar.`); } }
   finally { lock.current = false; if (mounted.current) setBusy(false); }
 }
 if (!draft) return store.error ? <RadarDraftProblem error={store.error} onDiscard={store.discard} href="/mis-propuestas-servicio"/> : <p role="status">Recuperando tu borrador…</p>;
 const disabled = busy || draft.uncertain;
 return <div ref={live} className={styles.stack}><h2>{initial ? "Editar propuesta" : "Tu propuesta"}</h2><button type="button" className="outline-button" disabled={busy} onClick={onRefresh}>Actualizar estado guardado</button><RadarFeedback {...services} retry={services.reload}/>{store.warning && <p className={styles.notice}>{store.warning}</p>}{error && <p role="alert" className={styles.notice}>{error}</p>}
   {services.data && (!eligible.length || !complete) && <p className={styles.notice}>No encontramos un servicio propio publicado, habilitado y compatible con esta especialidad. <Link href="/mis-servicios">Revisar Mis servicios</Link> · <Link href="/mi-perfil-profesional">Revisar mi cobertura</Link></p>}
   {draft.uncertain && <div className={styles.notice}><p>El envío no está confirmado. Conservamos tu mensaje y presupuesto.</p><button className="outline-button" disabled={busy} onClick={() => void verify()}>Verificar propuesta guardada</button><Link href="/mis-propuestas-servicio">Revisar Mis propuestas</Link></div>}
   {conflict && <div className={styles.notice}><p>Tu propuesta cambió. No vamos a sobrescribirla con una versión anterior. Usá Actualizar estado guardado antes de continuar.</p><button className="outline-button" disabled={busy || remoteChanged} onClick={() => { if (initial) store.update({ id: initial.id,requestId,listingId: initial.service_listing_id,message: initial.message,mode: initial.pricing_mode,price: initial.proposed_price?.toString() ?? "",baseRevision: initial.revision,uncertain: false }); }}>Descartar mis cambios y usar versión guardada</button></div>}
   <form className={styles.panel} onSubmit={event => { event.preventDefault(); void save(); }}>
     <label className={styles.field}>Servicio profesional<select required value={draft.listingId} disabled={disabled || !!initial || services.loading || !!services.error} onChange={event => patch({ listingId: event.target.value })}><option value="">Elegí tu servicio</option>{draft.listingId && !eligible.some(item => item.id === draft.listingId) && <option value={draft.listingId}>Servicio no disponible para proponer</option>}{eligible.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
     <label className={styles.field}>Mensaje<textarea minLength={10} maxLength={1500} required disabled={disabled} value={draft.message} onChange={event => patch({ message: event.target.value })} placeholder="Puedo revisar la instalación y preparar un presupuesto según el problema encontrado."/><small>{draft.message.length}/1500 · mínimo 10</small></label>
     <label className={styles.field}>Modalidad del presupuesto<select value={draft.mode} disabled={disabled} onChange={event => patch({ mode: event.target.value === "FIXED" ? "FIXED" : event.target.value === "FROM" ? "FROM" : "QUOTE" })}><option value="QUOTE">A presupuestar</option><option value="FIXED">Precio fijo</option><option value="FROM">Precio desde</option></select></label>
     {draft.mode !== "QUOTE" && <label className={styles.field}>Importe en pesos argentinos<input inputMode="decimal" required maxLength={32} disabled={disabled} value={draft.price} onChange={event => patch({ price: event.target.value })} placeholder="Ej. 35000"/><small>Importe positivo, con hasta dos decimales. Sin separadores de miles.</small></label>}
     <p className={styles.meta}>Podés enviar una sola propuesta para esta solicitud. Si la retirás, no podrás presentar otra. La elección no implica pago ni contratación automática.</p>
     <button className="primary-button" disabled={disabled || conflict || !complete || services.loading || !!services.error || !eligible.some(item => item.id === draft.listingId)}>{busy ? "Confirmando…" : initial ? "Guardar propuesta" : "Enviar propuesta"}</button>
   </form>
 </div>;
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useUserLocation } from "@/components/location/user-location-provider";
import { BackLink } from "@/components/navigation/back-link";
import { ArticleLocality } from "@/components/personal-listings/article-locality";
import { readServiceCategories } from "@/lib/services/client";
import { assertServiceSession } from "@/lib/services/frontend";
import { provinceByCode } from "@/lib/argentina-provinces";
import { readMyServiceRequests, readServiceRequestOffers, saveMyServiceRequest } from "@/lib/service-radar/client";
import { serviceRequestPrivacyNotice } from "@/lib/service-radar/contracts";
import { parseRequestDraft, requestMatches, type RequestDraft } from "@/lib/service-radar/frontend";
import { radarReturnTo } from "@/lib/service-radar/navigation";
import type { ServiceRequestView } from "@/types/service-radar";
import type { PublicServiceCategory } from "@/types/services";
import { dateLabel, radarClient, radarUiError, requestIsOpen, useRadarDraft, useRadarQuery, useExpiryRefresh, RadarFeedback, RadarDraftProblem } from "./radar-common";
import flow from "@/components/publish/publish-flow.module.css";
import {PublishProgress} from "@/components/publish/publish-progress";
import styles from "./service-radar.module.css";

export function RequestEditor({ id }: { id?: string }) {
 const load = useCallback(async (signal: AbortSignal) => {
   const client = radarClient(), categories = await readServiceCategories(client, signal);
   if (!id) return { categories, row: null, total: 0 };
   const [requests, offers] = await Promise.all([readMyServiceRequests(client, { requestId: id, pageSize: 1 }, signal), readServiceRequestOffers(client, { requestId: id, pageSize: 1 }, signal)]);
   return { categories, row: requests.items[0] ?? null, total: offers.total };
 }, [id]);
 const resource = useRadarQuery(`request-editor:${id ?? "new"}`, load);
 useExpiryRefresh(resource.data?.row?.status === "OPEN" ? [resource.data.row.expires_at] : [],resource.reload);
 return <><RadarFeedback loading={resource.loading} error={resource.error} retry={resource.reload}/>{resource.data && (id && !resource.data.row ? <p className={styles.notice}>Esta solicitud no está disponible para tu cuenta.</p> : id && (!requestIsOpen(resource.data.row!) || resource.data.total > 0) ? <section className={styles.panel}><h1>No podés editar esta solicitud</h1><p>{resource.data.total ? "Esta solicitud ya recibió propuestas. Para cambiar las condiciones, cerrala o cancelala y publicá una nueva." : "La solicitud ya no está disponible para editar."}</p><Link href={`/solicitud-servicio/${id}`} className="outline-button">Ver solicitud</Link></section> : <RequestForm key={id ?? "new"} initial={resource.data.row} categories={resource.data.categories} onRefresh={resource.reload}/>)}</>;
}

function RequestForm({ initial, categories, onRefresh }: { initial: ServiceRequestView | null; categories: PublicServiceCategory[]; onRefresh: () => void }) {
 const { user } = useAuth(), { locality, provinceCode } = useUserLocation(), router = useRouter(), params = useSearchParams();
 const returnTo = radarReturnTo(params.get("returnTo"));
 const store = useRadarDraft<RequestDraft>(`cercaya.service-radar.request.${user?.id}.${initial?.id ?? "new"}`, () => ({
   id: initial?.id ?? crypto.randomUUID(), baseRevision: initial?.revision ?? null, step: 1, uncertain: false,
   input: initial ? { title: initial.title, description: initial.description, category_id: initial.category_id, city: initial.city, province_code: initial.province_code }
     : { title: "", description: "", category_id: "", city: locality ?? "", province_code: provinceCode ?? "" },
 }), value => { const parsed = parseRequestDraft(value); return parsed && (!initial || parsed.id === initial.id) ? parsed : null; });
 const draft = store.draft, [busy, setBusy] = useState(false), [error, setError] = useState(""), [remoteChanged,setRemoteChanged] = useState(false), lock = useRef(false), mounted = useRef(true);
 const errorFocus=useRef<HTMLParagraphElement>(null);
 useEffect(()=>{if(error)errorFocus.current?.focus();},[error]);
 // The auth boundary unmounts this form on account changes; check the session again before writes.
 const live = useCallback((node: HTMLDivElement | null) => { mounted.current = !!node; }, []);
 const leaves = categories.filter(item => item.parent_id && categories.some(parent => parent.id === item.parent_id));
 const conflict = remoteChanged || (!!initial && draft?.baseRevision !== initial.revision);
 function patch(input: Partial<RequestDraft["input"]>) { if (draft) store.update({ ...draft, input: { ...draft.input, ...input } }); }
 function stepProblem(step: number) {
   if (!draft) return "No pudimos recuperar el formulario.";
   if (step === 1 && (draft.input.title.trim().length < 8 || draft.input.title.length > 120 || draft.input.description.trim().length < 20 || draft.input.description.length > 2000 || !leaves.some(item => item.id === draft.input.category_id))) return "Completá el título, la descripción y una especialidad disponible.";
   if (step === 2 && (!draft.input.city.trim() || draft.input.city.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(draft.input.city) || !provinceByCode(draft.input.province_code))) return "Elegí una localidad y provincia válidas.";
   return "";
 }
 function confirmed(row: ServiceRequestView) {
   if (!mounted.current) return;
   store.clear(); router.replace(`/solicitud-servicio/${row.id}?returnTo=${encodeURIComponent(returnTo)}`);
 }
 async function verify() {
   if (!draft || lock.current) return;
   lock.current = true; setBusy(true); setError("");
   try {
     const client = radarClient(); await assertServiceSession(client, user?.id ?? "");
     const row = (await readMyServiceRequests(client, { requestId: draft.id, pageSize: 1 })).items[0];
     if (!mounted.current) return;
     if (row && requestMatches(row, draft.input) && (draft.baseRevision === null || row.revision > draft.baseRevision)) { confirmed(row); return; }
     store.update({ ...draft, uncertain: false });
     if (row && row.revision !== draft.baseRevision) setRemoteChanged(true);
     setError(row && row.revision !== draft.baseRevision ? "La información cambió. Tus datos escritos siguen conservados. Revisá la solicitud antes de continuar." : "No encontramos el cambio confirmado. Podés volver a intentar con los mismos datos.");
   } catch (cause) { if (mounted.current) setError(radarUiError(cause)); }
   finally { lock.current = false; if (mounted.current) setBusy(false); }
 }
 async function save() {
   if (!draft || lock.current || draft.uncertain || conflict) return;
   const problem = stepProblem(1) || stepProblem(2); if (problem) { setError(problem); return; }
   lock.current = true; setBusy(true); setError(""); store.update({ ...draft, uncertain: true });
   try {
     const client = radarClient(); await assertServiceSession(client, user?.id ?? "");
     const before = (await readMyServiceRequests(client, { requestId: draft.id, pageSize: 1 })).items[0];
     if (before && draft.baseRevision === null) { if (requestMatches(before, draft.input)) { confirmed(before); return; } throw new Error("La información cambió. Revisá la solicitud guardada antes de continuar."); }
     if (initial && (!before || before.revision !== draft.baseRevision || !requestIsOpen(before))) throw new Error("La información cambió. Volvé a cargar antes de continuar.");
     await assertServiceSession(client, user?.id ?? ""); if (!mounted.current) return;
     await saveMyServiceRequest(client, draft.id, draft.input, draft.baseRevision);
     const row = (await readMyServiceRequests(client, { requestId: draft.id, pageSize: 1 })).items[0];
     if (!row || !requestMatches(row, draft.input) || (draft.baseRevision !== null && row.revision <= draft.baseRevision)) throw new Error("No pudimos confirmar el cambio. Verificá el estado guardado.");
     confirmed(row);
   } catch (cause) {
     if (mounted.current) { if (cause instanceof Error && cause.message.startsWith("La información cambió")) setRemoteChanged(true); setError(`${radarUiError(cause)} Conservamos tus datos; verificá el estado antes de reintentar.`); }
   } finally { lock.current = false; if (mounted.current) setBusy(false); }
 }
 if (!draft) return store.error ? <RadarDraftProblem error={store.error} onDiscard={store.discard} href="/mis-solicitudes-servicio"/> : <p role="status">Recuperando tu borrador…</p>;
 const disabled = busy || draft.uncertain;
 return <div ref={live} className={flow.flow}><BackLink href={initial ? `/solicitud-servicio/${initial.id}?returnTo=${encodeURIComponent(returnTo)}` : returnTo}>Volver</BackLink>
   <div className={styles.title}><h1>{initial ? "Editar solicitud" : "¿Qué trabajo necesitás?"}</h1><p>Contanos qué trabajo necesitás y dónde. Sin pagos ni contratación automática.</p></div>
   <PublishProgress steps={["Qué necesitás","Dónde","Revisar"]} current={draft.step-1}/>
   <div className={styles.actions}><button type="button" className="outline-button" disabled={busy} onClick={onRefresh}>Actualizar estado guardado</button></div>
   {store.warning && <p className={styles.notice}>{store.warning}</p>}{error && <p id="service-request-feedback" ref={errorFocus} tabIndex={-1} role="alert" className="form-error">{error}</p>}
   {draft.uncertain && <div className={styles.notice}><p>El resultado todavía no está confirmado. Verificá qué quedó guardado antes de continuar.</p><button type="button" className="outline-button" disabled={busy} onClick={() => void verify()}>Verificar estado guardado</button></div>}
   {conflict && <div className={styles.notice}><p>La solicitud cambió mientras la editabas. Conservamos tus datos, pero no vamos a sobrescribirla. Usá Actualizar estado guardado para revisar la versión actual.</p><Link href={`/solicitud-servicio/${draft.id}`}>Ver versión guardada</Link><button className="outline-button" disabled={busy || remoteChanged} onClick={() => { if (initial) store.update({ id: initial.id, input: { title: initial.title, description: initial.description, city: initial.city, province_code: initial.province_code, category_id: initial.category_id }, baseRevision: initial.revision, step: 1, uncertain: false }); }}>Descartar mis cambios y usar versión guardada</button></div>}
   <div className={flow.status} data-tone={draft.uncertain||conflict?"warning":undefined} role="status">{busy?"Comprobando el resultado…":conflict?"La versión guardada cambió. Revisala antes de continuar.":draft.uncertain?"Publicación pendiente de verificar; no reintentamos automáticamente.":"Tu avance es un borrador de este navegador. La solicitud se guarda en tu cuenta al confirmar y verificar la publicación."}</div>
   <form className={styles.panel} aria-busy={busy} aria-describedby={error?"service-request-feedback":undefined} onSubmit={event => { event.preventDefault(); if (draft.step < 3) { const problem = stepProblem(draft.step); setError(problem); if (!problem) store.update({ ...draft, step: draft.step + 1 }); } else void save(); }}>
     {draft.step === 1 && <><h2>Describí el trabajo</h2><label className={styles.field}>Título<input id="service-request-title" aria-describedby="service-request-title-help" maxLength={120} minLength={8} required disabled={disabled} value={draft.input.title} onChange={event => patch({ title: event.target.value })} placeholder="Necesito un plomero"/><small id="service-request-title-help">{draft.input.title.length}/120 · mínimo 8 caracteres. Resumí qué trabajo necesitás.</small></label><label className={styles.field}>Descripción<textarea aria-describedby="service-request-description-help" maxLength={2000} minLength={20} required disabled={disabled} value={draft.input.description} onChange={event => patch({ description: event.target.value })}/><small id="service-request-description-help">{draft.input.description.length}/2000 · mínimo 20 caracteres. Contá el problema sin teléfonos, emails ni dirección exacta.</small></label><label className={styles.field}>Especialidad<select required disabled={disabled} value={draft.input.category_id} onChange={event => patch({ category_id: event.target.value })}><option value="">Elegí una especialidad</option>{categories.filter(group => !group.parent_id).map(group => <optgroup key={group.id} label={group.name}>{leaves.filter(item => item.parent_id === group.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></label><p className={styles.meta}>{serviceRequestPrivacyNotice}</p></>}
     {draft.step === 2 && <><h2>¿Dónde necesitás el servicio?</h2><ArticleLocality province={draft.input.province_code} city={draft.input.city} disabled={disabled} onProvince={value => patch({ province_code: value, city: "" })} onCity={value => patch({ city: value })}/><p>Por tu privacidad, publicá solamente tu localidad. Después podrás coordinar los detalles directamente con el profesional que elijas.</p></>}
     {draft.step === 3 && <><h2>Revisá tu solicitud</h2><p data-publish-help>Esta vista previa todavía no confirma la publicación. Revisá qué necesitás y en qué localidad.</p><h3>{draft.input.title}</h3><p className={styles.description}>{draft.input.description}</p><p>{leaves.find(item => item.id === draft.input.category_id)?.name ?? "Especialidad no disponible"}</p><p>{draft.input.city}, {provinceByCode(draft.input.province_code)?.name}</p><p className={styles.meta}>{initial ? `Vence el ${dateLabel(initial.expires_at)}` : `Vence a los 7 días de publicarse. Fecha estimada: ${dateLabel(new Date(Date.now()+7*86400000).toISOString())}. Se confirma al publicar.`}</p><p className={styles.notice}>{serviceRequestPrivacyNotice}</p></>}
     <div className={`${styles.actions} ${flow.actions}`}>{draft.step > 1 && <button type="button" className="outline-button" disabled={disabled} onClick={() => store.update({ ...draft, step: draft.step - 1 })}>Volver a editar</button>}<button type="submit" className="primary-button" disabled={disabled || conflict}>{busy ? "Confirmando…" : draft.step < 3 ? "Continuar" : initial ? "Guardar cambios" : "Publicar solicitud"}</button></div>
   </form>
 </div>;
}

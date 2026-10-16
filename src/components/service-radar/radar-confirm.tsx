"use client";
import { useRef,useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Dialog } from "@/components/home/dialog";
import { assertServiceSession } from "@/lib/services/frontend";
import { manageMyServiceRequest,manageMyServiceRequestOffer,readMyServiceRequests,readServiceRequestOffers } from "@/lib/service-radar/client";
import type { ServiceRequestView,ServiceRequestOfferView } from "@/types/service-radar";
import { radarClient,radarUiError } from "./radar-common";
import styles from "./service-radar.module.css";
export type RadarAction = "accept" | "reject" | "withdraw" | "close" | "cancel" | "expire";
const labels: Record<RadarAction,string> = { accept: "Confirmar elección",reject: "Rechazar propuesta",withdraw: "Retirar propuesta",close: "Cerrar solicitud",cancel: "Cancelar solicitud",expire: "Confirmar solicitud vencida" };
export function RadarConfirm({ action,request,offer,onClose,onConfirmed,onIndeterminate }: { action: RadarAction; request: ServiceRequestView; offer?: ServiceRequestOfferView; onClose: () => void; onConfirmed: () => void; onIndeterminate?: () => void }) {
 const { user } = useAuth(),[busy,setBusy] = useState(false),[error,setError] = useState(""),[uncertain,setUncertain] = useState(false),lock = useRef(false);
 const acknowledged = useRef(false);
 async function reconcile() {
   const client = radarClient(); await assertServiceSession(client,user?.id ?? "");
   if (action === "close" || action === "cancel" || action === "expire") {
     const row = (await readMyServiceRequests(client,{ requestId: request.id,pageSize: 1 })).items[0];
     return !!row && row.revision > request.revision && (action === "expire" ? acknowledged.current && row.status === "EXPIRED" : action === "cancel" ? row.status === "CANCELLED" : row.status === "CLOSED" && row.selected_offer_id === null);
   }
   if (!offer) return false;
   const row = (await readServiceRequestOffers(client,{ seller: action === "withdraw",offerId: offer.id,pageSize: 1 })).items[0];
   if (!row || row.revision <= offer.revision) return false;
   if (action === "accept") {
     const parent = (await readMyServiceRequests(client,{ requestId: request.id,pageSize: 1 })).items[0];
     return row.status === "ACCEPTED" && parent?.status === "CLOSED" && parent.selected_offer_id === offer.id;
   }
   return row.status === (action === "withdraw" ? "WITHDRAWN" : "REJECTED");
 }
 async function run(verifyOnly = false) {
   if (lock.current || (uncertain && !verifyOnly)) return; lock.current = true; setBusy(true); setError("");
   try {
     const client = radarClient(); await assertServiceSession(client,user?.id ?? "");
     if (!verifyOnly) {
       setUncertain(true);
       if (action === "close" || action === "cancel" || action === "expire") await manageMyServiceRequest(client,request.id,request.revision,action);
       else if (offer) await manageMyServiceRequestOffer(client,offer.id,offer.revision,action,action === "withdraw" ? null : request.revision);
       else throw new Error();
       acknowledged.current = true;
     }
     if (await reconcile()) { onConfirmed(); return; }
     if (action === "expire") onIndeterminate?.();
     setError("No pudimos confirmar ese resultado. Cerrá esta ventana y actualizá el historial antes de decidir otra acción.");
   } catch(cause) {
     // A lost response is reconciled, never treated as a failed write or a success by itself.
     try { if (await reconcile()) { onConfirmed(); return; } } catch { /* keep the outcome uncertain */ }
     if (action === "expire") onIndeterminate?.();
     setError(action === "expire" ? "La solicitud ya se considera vencida. No pudimos confirmar una actualización adicional; cerrá esta ventana y revisá el historial." : radarUiError(cause));
   } finally { lock.current = false; setBusy(false); }
 }
 const text = action === "expire" ? "La solicitud ya venció y no acepta propuestas. Podés confirmar ese estado si todavía necesita actualizarse. Esto no cambia la fecha, no la reabre y no puede deshacerse." : action === "accept" ? "¿Querés elegir a este profesional? Al hacerlo se cerrará tu solicitud y las demás propuestas pendientes serán rechazadas." : action === "withdraw" ? "Retirar tu propuesta es definitivo. No podrás presentar otra para esta solicitud." : action === "reject" ? "Esta propuesta dejará de estar disponible para elegir. Podés seguir comparando las restantes." : "La solicitud dejará de recibir propuestas y las pendientes serán rechazadas. Esta acción no se puede deshacer.";
 return <Dialog title={labels[action]} preventCancel onClose={() => { if (!busy) onClose(); }}><div className={styles.modal}><h2>{labels[action]}</h2><p>{text}</p><strong>{offer?.provider_name ?? request.title}</strong>{action === "accept" && <p className={styles.meta}>Elegir no significa que el trabajo esté realizado ni pagado. Después podrás coordinar directamente.</p>}{error && <p role="alert">{error}</p>}{uncertain && <p className={styles.meta} role="status">{action === "expire" && !busy ? "La actualización del vencimiento sigue indeterminada. La solicitud continúa vencida y no se reintentará automáticamente." : "Verificá el estado remoto antes de volver a intentar una acción."}</p>}<div className={styles.actions}><button className="outline-button" disabled={busy} onClick={onClose}>{uncertain ? "Cerrar y actualizar historial" : "Volver"}</button><button className="primary-button" disabled={busy} onClick={() => void run(uncertain)}>{busy ? "Verificando…" : uncertain ? "Verificar resultado" : labels[action]}</button></div></div></Dialog>;
}

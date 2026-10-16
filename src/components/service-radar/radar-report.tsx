"use client";
import { useRef,useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Dialog } from "@/components/home/dialog";
import { radarReportReasons } from "@/lib/service-radar/contracts";
import { reportServiceRadar } from "@/lib/service-radar/client";
import { assertServiceSession } from "@/lib/services/frontend";
import type { ServiceRadarEntity,ServiceRadarReportReason } from "@/types/service-radar";
import { radarClient,radarUiError } from "./radar-common";
import styles from "./service-radar.module.css";
export function RadarReport({ entity,id }: { entity: ServiceRadarEntity; id: string }) {
 const { user } = useAuth(),[open,setOpen] = useState(false),[reason,setReason] = useState<ServiceRadarReportReason>("Información inapropiada"),[details,setDetails] = useState(""),[error,setError] = useState(""),[busy,setBusy] = useState(false),[sent,setSent] = useState(false),lock = useRef(false);
 async function send() { if (lock.current || sent) return; lock.current = true; setBusy(true); setError("");
   try { const client = radarClient(); await assertServiceSession(client,user?.id ?? ""); await reportServiceRadar(client,entity,id,reason,details); setSent(true); }
   catch(cause) { setError(radarUiError(cause)); } finally { lock.current = false; setBusy(false); }
 }
 return <><button type="button" className="secondary-link" onClick={() => setOpen(true)}>{entity === "request" ? "Reportar solicitud" : "Reportar propuesta"}</button>{open && <Dialog title="Reportar contenido" onClose={() => { if (!busy) setOpen(false); }} preventCancel><div className={styles.modal}><h2>Reportar {entity === "request" ? "solicitud" : "propuesta"}</h2>{sent ? <p role="status">Recibimos tu reporte. Si ya había uno abierto, se conserva el mismo.</p> : <><p className={styles.meta}>Contanos qué te preocupa. No incluyas datos privados innecesarios.</p><label className={styles.field}>Motivo<select disabled={busy} value={reason} onChange={event => { const value = radarReportReasons.find(item => item === event.target.value); if (value) setReason(value); }}>{radarReportReasons.map(value => <option key={value}>{value}</option>)}</select></label><label className={styles.field}>Detalles opcionales<textarea disabled={busy} maxLength={1000} value={details} onChange={event => setDetails(event.target.value)}/><small>{details.length}/1000</small></label>{error && <p role="alert">{error}</p>}<button className="primary-button" disabled={busy} onClick={() => void send()}>{busy ? "Enviando…" : "Enviar reporte"}</button></>}<button className="outline-button" disabled={busy} onClick={() => setOpen(false)}>Cerrar</button></div></Dialog>}</>;
}

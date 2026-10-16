"use client";
import Link from "next/link";
import {useRef,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {Dialog} from "@/components/home/dialog";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {loginUrl} from "@/lib/auth/redirect";
import {reportService} from "@/lib/services/client";
import {serviceReportReasons} from "@/lib/services/contracts";
import {serviceUiError} from "@/lib/services/frontend";
import type {ServiceEntity,ServiceReportReason} from "@/types/services";
import styles from "@/components/personal-listings/personal-listings.module.css";
export function ServiceReport({entity,id}:{entity:ServiceEntity;id:string}){
 const {user,loading}=useAuth();
 return <ReportControl key={user?.id??"guest"} entity={entity} id={id} authenticated={!!user} loading={loading}/>;
}
function ReportControl({entity,id,authenticated,loading}:{entity:ServiceEntity;id:string;authenticated:boolean;loading:boolean}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState<ServiceReportReason>(serviceReportReasons[0]),[details,setDetails]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[sent,setSent]=useState(false),lock=useRef(false);
 const label=entity==="provider"?"Reportar prestador":"Reportar servicio",returnTo=entity==="provider"?`/prestador/${id}`:`/servicio/${id}`;
 async function submit(){if(lock.current||!authenticated||sent)return;lock.current=true;setBusy(true);setError("");try{const client=getSupabaseBrowserClient();if(!client)throw new Error();await reportService(client,entity,id,reason,details);setSent(true);}catch(cause){setError(serviceUiError(cause,"No pudimos confirmar el reporte. Podés volver a intentar; no crearemos otro reporte abierto del mismo objetivo."));}finally{lock.current=false;setBusy(false);}}
 return <div style={{marginTop:"var(--space-6)"}}>{authenticated?<button className="secondary-link" type="button" onClick={()=>setOpen(true)}>{label}</button>:<Link className="secondary-link" aria-disabled={loading} href={loginUrl(returnTo)}>Iniciar sesión para {label.toLowerCase()}</Link>}{open&&<Dialog title={label} onClose={()=>{if(!busy)setOpen(false);}} preventCancel><div className={styles.modal}><h2>{sent?"Gracias por avisarnos.":label}</h2>{sent?<><p role="status">Recibimos tu reporte. Si ya tenías uno abierto, conservamos el mismo.</p><button className="primary-button" onClick={()=>setOpen(false)}>Cerrar</button></>:<form noValidate onSubmit={event=>{event.preventDefault();void submit();}}><p>Contanos qué encontraste. No incluyas datos personales ni información sensible.</p><fieldset disabled={busy} style={{border:0,padding:0,display:"grid",gap:"var(--space-4)"}}><label className={styles.field}>Motivo<select value={reason} onChange={event=>{const selected=serviceReportReasons.find(item=>item===event.target.value);if(selected)setReason(selected);}}>{serviceReportReasons.map(item=><option key={item} value={item}>{item}</option>)}</select></label><label className={styles.field}>Detalles (opcional)<textarea value={details} maxLength={1000} onChange={event=>setDetails(event.target.value)}/></label>{error&&<p role="alert" className="form-error">{error}</p>}<div className={styles.actions}><button className="outline-button" type="button" onClick={()=>setOpen(false)}>Cancelar</button><button className="primary-button" disabled={busy}>{busy?"Enviando…":"Enviar reporte"}</button></div></fieldset></form>}</div></Dialog>}</div>;
}


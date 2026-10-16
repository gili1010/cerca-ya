"use client";
import {useRef,useState} from "react";
import {Dialog} from "@/components/home/dialog";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {readUnattachedServicePhotos,cleanupServicePhotos} from "@/lib/services/images";
import {serviceUiError} from "@/lib/services/frontend";
import styles from "@/components/personal-listings/personal-listings.module.css";
export function ServicePhotoCleanup({id,kind,disabled}:{id:string;kind:"providers"|"listings";disabled:boolean}){
 const [paths,setPaths]=useState<string[]|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(""),[confirm,setConfirm]=useState(false),lock=useRef(false);
 async function inspect(remove=false){if(lock.current||disabled)return;lock.current=true;setBusy(true);setError("");try{const client=getSupabaseBrowserClient();if(!client)throw new Error();setPaths(remove?await cleanupServicePhotos(client,kind,id,paths??[]):await readUnattachedServicePhotos(client,kind,id));setConfirm(false);}catch(cause){setError(serviceUiError(cause));}finally{lock.current=false;setBusy(false);}}
 return <div className={styles.notice}><button type="button" className="secondary-link" disabled={disabled||busy} onClick={()=>void inspect()}>Revisar fotos temporales de intentos anteriores</button>{paths&&<p role="status">{paths.length?`${paths.length} fotos temporales sin vincular.`:"No hay fotos temporales pendientes."}</p>}{!!paths?.length&&<button type="button" className="outline-button" disabled={disabled||busy} onClick={()=>setConfirm(true)}>Eliminar temporales encontrados</button>}{error&&<p role="alert">{error}</p>}{confirm&&<Dialog title="Eliminar fotos temporales" onClose={()=>{if(!busy)setConfirm(false);}} preventCancel><div className={styles.modal}><h2>¿Eliminar estas fotos temporales?</h2><p>No están vinculadas. Cerrá otras pestañas de edición y guardá tus fotos antes de continuar. Las fotos vinculadas se protegen en el servidor.</p><div className={styles.actions}><button className="outline-button" disabled={busy} onClick={()=>setConfirm(false)}>Cancelar</button><button className="danger-button" disabled={busy} onClick={()=>void inspect(true)}>{busy?"Eliminando…":"Eliminar temporales"}</button></div></div></Dialog>}</div>;
}


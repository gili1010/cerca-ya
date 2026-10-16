"use client";
import Link from "next/link";
import {useEffect,useRef,useState} from "react";
import {useAuth} from "@/components/auth/auth-provider";
import {ArticleLocality} from "@/components/personal-listings/article-locality";
import {FormError} from "@/components/requests/request-common";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {createServiceProvider,updateServiceProvider,readMyServiceProvider,setServiceAreas} from "@/lib/services/client";
import {saveServiceProviderPhoto,readUnattachedServicePhotos} from "@/lib/services/images";
import {serviceUiError,serviceSessionId,rememberServiceId,providerPublishProblem,assertServiceSession} from "@/lib/services/frontend";
import {normalizeArgentinaPhone} from "@/lib/phone";
import {provinceByCode,normalizePlace} from "@/lib/argentina-provinces";
import type {OwnedServiceProvider,ServiceProviderInput,ServiceAreaInput} from "@/types/services";
import {useServiceWorkspace} from "./use-service-workspace";
import {useServicePhotoDraft} from "./use-service-photo-draft";
import {ServicePhotos} from "./service-photos";
import {ServiceAreasEditor} from "./service-areas-editor";
import {ServicePhotoCleanup} from "./service-photo-cleanup";
import styles from "@/components/personal-listings/personal-listings.module.css";

const emptyForm={name:"",description:"",city:"",province:"",whatsapp:"",consent:false,active:true};
function profileForm(p:OwnedServiceProvider){return{name:p.display_name,description:p.description,city:p.city,province:p.province_code,whatsapp:p.contact_whatsapp??"",consent:p.contact_consent_at!==null,active:p.active};}
export function ProfessionalProfile({continueToService=false,onContinue}:{continueToService?:boolean;onContinue?:()=>void}){
 const ws=useServiceWorkspace(),{user}=useAuth(),photo=useServicePhotoDraft(1);
 const [form,setForm]=useState(emptyForm),[areas,setAreas]=useState<ServiceAreaInput[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[frozen,setFrozen]=useState(false);
 const pendingId=useRef<string|null>(null),hydrated=useRef(false),lock=useRef(false),live=useRef(true);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{
  if(ws.loading||ws.error||hydrated.current||!user)return;
  hydrated.current=true;
  if(ws.provider){pendingId.current=ws.provider.id;setForm(profileForm(ws.provider));setAreas(ws.provider.areas.map(area=>({city:area.city,province_code:area.province_code})));photo.reset(ws.provider.avatar_path?[ws.provider.avatar_path]:[]);rememberServiceId("provider",user.id,null);}
  else{pendingId.current=pendingId.current??serviceSessionId("provider",user.id)??crypto.randomUUID();rememberServiceId("provider",user.id,pendingId.current);}
 },[ws.loading,ws.error,ws.provider,user,photo.reset]);
 const disabled=busy||photo.preparing||frozen||ws.suspended||!!ws.provider?.admin_blocked;
 function reload(){hydrated.current=false;setFrozen(false);setError("");setNotice("");ws.reload();}
 async function recoverPhoto(){
  if(lock.current||disabled||!ws.provider)return;lock.current=true;setBusy(true);setError("");
  try{const client=getSupabaseBrowserClient();if(!client)throw new Error();const paths=await readUnattachedServicePhotos(client,"providers",ws.provider.id);if(live.current){if(paths[0])photo.change([{key:paths[0],path:paths[0],localUrl:null,photo:null}]);setNotice(paths.length?"Foto temporal recuperada. Revisala y guardá para vincularla.":"No hay fotos temporales para recuperar.");}}
  catch(cause){if(live.current)setError(serviceUiError(cause));}finally{lock.current=false;if(live.current)setBusy(false);}
 }
 async function save(kind:"profile"|"areas"|"photo"){
  if(lock.current||disabled||!user)return;
  if(kind==="profile"){
   if(!form.name.trim()||!form.city.trim()||!provinceByCode(form.province)){setError("Completá nombre público, localidad y provincia.");return;}
   if(form.whatsapp.trim()&&(!normalizeArgentinaPhone(form.whatsapp)||!form.consent)){setError("Indicá un WhatsApp válido y autorizá su publicación, o dejá el campo vacío.");return;}
  }else if(!ws.provider){setError("Guardá primero tu perfil profesional.");return;}
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   const client=getSupabaseBrowserClient();if(!client)throw new Error();
   await assertServiceSession(client,user.id);if(!live.current)throw new Error();
   const base=ws.provider,id=base?.id??pendingId.current;if(!id)throw new Error();
   let current:OwnedServiceProvider|null=null;
   if(kind==="profile"){
    const input:ServiceProviderInput={display_name:form.name.trim(),description:form.description,city:form.city.trim().replace(/\s+/g," "),province_code:form.province,active:form.active,
     contact_method:form.whatsapp.trim()?"WHATSAPP":"NONE",contact_whatsapp:form.whatsapp.trim()||null,contact_consent:!!form.whatsapp.trim()&&form.consent};
    if(base)await updateServiceProvider(client,id,base.revision,input);else await createServiceProvider(client,id,input);
    current=await readMyServiceProvider(client);
    const phone=input.contact_method==="WHATSAPP"?`+${normalizeArgentinaPhone(input.contact_whatsapp)}`:null;
    if(!current||current.id!==id||current.revision!==(base?base.revision+1:1)||current.display_name!==input.display_name||current.description!==input.description||normalizePlace(current.city)!==normalizePlace(input.city)||current.province_code!==input.province_code||current.active!==input.active||current.contact_whatsapp!==phone)throw new Error("La información cambió. Volvé a cargar antes de guardar.");
    if(live.current)setForm(profileForm(current));rememberServiceId("provider",user.id,null);
   }else if(kind==="areas"&&base){
    await setServiceAreas(client,id,base.revision,areas);current=await readMyServiceProvider(client);
    const expected=areas.map(area=>`${area.province_code}:${normalizePlace(area.city)}`).sort().join("|"),actual=current?.areas.map(area=>`${area.province_code}:${normalizePlace(area.city)}`).sort().join("|");
    if(!current||current.revision!==base.revision+1||expected!==actual)throw new Error("La información cambió. Volvé a cargar antes de guardar.");
    if(live.current)setAreas(current.areas.map(area=>({city:area.city,province_code:area.province_code})));
   }else if(kind==="photo"&&base){
    const paths=await photo.upload(client,"providers",id,()=>assertServiceSession(client,user.id));
    await assertServiceSession(client,user.id);if(!live.current)throw new Error();
    const result=await saveServiceProviderPhoto(client,base,paths[0]??null);
    if(!result.success||!result.current)throw new Error(result.message);
    current=result.current;if(live.current)photo.reset(current.avatar_path?[current.avatar_path]:[]);
    if(result.pendingCleanup.length&&live.current)setNotice("Foto guardada. Hay temporales pendientes; podés revisarlos más abajo.");
   }
   if(!current)throw new Error();if(live.current){ws.setProvider(current);setNotice(previous=>previous||"Cambios guardados.");}
  }catch(cause){
   // Conservar UUID y leer, sin prometer éxito ni repetir una creación incierta.
   try{const client=getSupabaseBrowserClient();if(client){const current=await readMyServiceProvider(client);if(current)pendingId.current=current.id;}}catch{/* Bloquear hasta una relectura explícita. */}
   if(live.current){setError(serviceUiError(cause));setFrozen(true);}
  }finally{lock.current=false;if(live.current)setBusy(false);}
 }
 if(ws.loading)return <p role="status">Cargando tu perfil profesional…</p>;
 if(ws.error)return <div className="panel"><FormError message={ws.error}/><button className="outline-button" onClick={reload}>Reintentar</button></div>;
 return <div className={styles.wizard}><div className={styles.heading}><span className="eyebrow">TU OFICIO EN CERCAYA</span><h1>Mi perfil profesional</h1><p>Presentate y contá dónde trabajás. No necesitás crear una tienda.</p></div>
 {ws.suspended&&<p className="form-error">Tu cuenta está suspendida. Sólo podés consultar tus datos.</p>}{ws.provider?.admin_blocked&&<p className="form-error">Tu perfil está bloqueado. {ws.provider.admin_block_reason}</p>}
 <FormError message={error}/>{notice&&<p role="status" className={styles.notice}>{notice}</p>}{frozen&&<div className={styles.notice}>Revisá lo que quedó guardado antes de seguir. <button type="button" className="outline-button" disabled={busy} onClick={reload}>Recargar datos guardados (descarta cambios locales)</button></div>}
 <form className={`panel ${styles.formPanel}`} noValidate onSubmit={event=>{event.preventDefault();void save("profile");}}><fieldset disabled={disabled}><legend>Tu presentación</legend>
 <label className={styles.field}>Nombre público<input required maxLength={120} value={form.name} placeholder="Ej. Electricidad Juan" onChange={event=>setForm({...form,name:event.target.value})}/></label>
 <label className={styles.field}>Presentación<textarea maxLength={5000} value={form.description} onChange={event=>setForm({...form,description:event.target.value})}/></label>
 <ArticleLocality city={form.city} province={form.province} onCity={value=>setForm({...form,city:value})} onProvince={value=>setForm({...form,province:value,city:""})} disabled={disabled}/>
 <label className={styles.field}>WhatsApp (opcional para guardar el perfil)<input type="tel" value={form.whatsapp} maxLength={30} placeholder="Código de área y número" onChange={event=>setForm({...form,whatsapp:event.target.value,consent:false})}/></label>
 <label className={styles.check}><input type="checkbox" checked={form.consent} onChange={event=>setForm({...form,consent:event.target.checked})}/><span>Autorizo mostrar este WhatsApp para recibir consultas por mis servicios.</span></label>
 <label className={styles.check}><input type="checkbox" checked={form.active} onChange={event=>setForm({...form,active:event.target.checked})}/><span>Perfil profesional activo</span></label>
 <p className={styles.hint}>Desactivar oculta tus servicios sin borrarlos. Los pausados o retirados conservan su estado al reactivar. Si tenés servicios publicados, pausá esos servicios o desactivá el perfil antes de quitar su contacto autorizado o toda la cobertura.</p>
 <button className="primary-button" disabled={disabled}>{busy?"Guardando…":ws.provider?"Guardar perfil":"Crear perfil profesional"}</button></fieldset></form>
 <section className={`panel ${styles.formPanel}`} style={{marginTop:"var(--space-5)"}}><h2>Localidades donde trabajo</h2><ServiceAreasEditor areas={areas} onChange={setAreas} disabled={disabled||!ws.provider}/><button type="button" className="primary-button" disabled={disabled||!ws.provider} onClick={()=>void save("areas")}>Guardar cobertura</button>{!ws.provider&&<p className={styles.hint}>Guardá primero el perfil; después podés completar tu cobertura.</p>}</section>
 <section className={`panel ${styles.formPanel}`} style={{marginTop:"var(--space-5)"}}><h2>Foto o logo</h2><ServicePhotos avatar photos={photo.photos} disabled={disabled||!ws.provider} preparing={photo.preparing} onAdd={files=>void photo.add(files)} onChange={photo.change}/><FormError message={photo.error}/>{ws.provider&&<button type="button" className="secondary-link" disabled={disabled} onClick={()=>void recoverPhoto()}>Recuperar foto temporal de un intento anterior</button>}<button type="button" className="outline-button" disabled={disabled||!ws.provider} onClick={()=>void save("photo")}>Guardar foto de perfil</button>{ws.provider&&<ServicePhotoCleanup id={ws.provider.id} kind="providers" disabled={disabled||photo.photos.some(item=>!item.path||item.path!==ws.provider?.avatar_path)}/>}</section>
 <div className={styles.notice}>{ws.provider?providerPublishProblem(ws.provider)||"Tu perfil ya cumple los requisitos para publicar servicios.":"Podés crear el perfil sin WhatsApp ni cobertura; se necesitarán al publicar."}</div>
 <div className={styles.actions}>{onContinue?<button type="button" className="primary-button" disabled={!ws.provider||busy} onClick={onContinue}>Continuar con mi servicio</button>:<Link className="primary-button" href="/publicar/servicio">{continueToService?"Continuar con mi servicio":"Publicar un servicio"}</Link>}<Link className="outline-button" href="/mis-servicios">Mis servicios</Link></div>
 </div>;
}


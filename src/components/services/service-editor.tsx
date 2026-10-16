"use client";
import {useEffect,useRef,useState} from "react";
import Link from "next/link";
import {useAuth} from "@/components/auth/auth-provider";
import {BackLink} from "@/components/navigation/back-link";
import {FormError} from "@/components/requests/request-common";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {createServiceListing,updateServiceListing,readMyServiceListing,readPublicServiceListing,manageServiceListing} from "@/lib/services/client";
import {saveServiceListingPhotos,readUnattachedServicePhotos} from "@/lib/services/images";
import {serviceInputProblem,servicePrice,serviceUiError,serviceSessionId,rememberServiceId,providerPublishProblem,serviceModeLabels,assertServiceSession} from "@/lib/services/frontend";
import type {OwnedServiceListing,ServiceListingInput,ServiceMode,ServicePricingMode} from "@/types/services";
import {useServiceWorkspace} from "./use-service-workspace";
import {useServicePhotoDraft} from "./use-service-photo-draft";
import {ServicePhotos} from "./service-photos";
import {ServicePhotoCleanup} from "./service-photo-cleanup";
import {useSignedServicePhotos} from "./use-signed-service-photos";
import {ServicePresentation} from "./service-presentation";
import {ProfessionalProfile} from "./professional-profile";
import styles from "@/components/personal-listings/personal-listings.module.css";

const empty={title:"",description:"",category:"",mode:"ONSITE" as ServiceMode,pricing:"QUOTE" as ServicePricingMode,price:"",accepting:true};
function inputOf(row:OwnedServiceListing):ServiceListingInput{return{title:row.title,description:row.description,category_id:row.category_id,service_mode:row.service_mode,pricing_mode:row.pricing_mode,price:row.price,accepting_inquiries:row.accepting_inquiries};}
export function ServiceEditor({listingId}:{listingId?:string}){
 const ws=useServiceWorkspace(),{user}=useAuth(),photo=useServicePhotoDraft();
 const [base,setBase]=useState<OwnedServiceListing|null>(null),[form,setForm]=useState(empty),[step,setStep]=useState(0),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[frozen,setFrozen]=useState(false),[success,setSuccess]=useState(false),[missing,setMissing]=useState(false);
 const pendingId=useRef<string|null>(listingId??null),initialized=useRef(false),lock=useRef(false),live=useRef(true),[attempt,setAttempt]=useState(0);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 const signed=useSignedServicePhotos(base?[...base.images.map(item=>item.object_path),...(base.provider.avatar_path?[base.provider.avatar_path]:[])]:[]);
 useEffect(()=>{
  if(ws.loading||ws.error||!user)return;let active=true;
  if(!ws.provider){setLoading(false);return;}
  if(initialized.current)return;initialized.current=true;setLoading(true);
  async function load(){
   try{
    const client=getSupabaseBrowserClient();if(!client)throw new Error();
    const id=pendingId.current??(!listingId?serviceSessionId("listing",user!.id):null)??crypto.randomUUID();pendingId.current=id;
    if(!listingId)rememberServiceId("listing",user!.id,id);
    const saved=await readMyServiceListing(client,id);if(!active)return;
    if(listingId&&!saved){setMissing(true);return;}
    setBase(saved);setMissing(false);setFrozen(false);setSuccess(false);setError("");
    if(saved){ws.setProvider(saved.provider);setForm({title:saved.title,description:saved.description,category:saved.category_id,mode:saved.service_mode,pricing:saved.pricing_mode,price:saved.price===null?"":String(saved.price),accepting:saved.accepting_inquiries});photo.reset(saved.images.map(item=>item.object_path));if(!listingId)setNotice("Recuperamos tu publicación guardada. Revisala antes de continuar.");}
    else{setForm(empty);photo.reset([]);setNotice("");}
   }catch(cause){if(active){setError(serviceUiError(cause));setFrozen(true);}}
   finally{if(active)setLoading(false);}
  }void load();return()=>{active=false;};
 },[ws.loading,ws.error,ws.provider,user?.id,listingId,attempt,photo.reset]);
 const terminal=base?.status==="WITHDRAWN",blocked=!!base?.admin_blocked||!!base?.provider.admin_blocked||!!ws.provider?.admin_blocked;
 const disabled=busy||photo.preparing||frozen||terminal||blocked||ws.suspended;
 function reload(){initialized.current=false;setLoading(true);setFrozen(false);setSuccess(false);ws.reload();setAttempt(v=>v+1);}
 function startAnother(){
  if(!base||!user||busy||photo.preparing||frozen||ws.suspended||blocked)return;
  const id=crypto.randomUUID();pendingId.current=id;rememberServiceId("listing",user.id,id);
  setBase(null);setForm(empty);photo.reset([]);setStep(0);setError("");setSuccess(false);
  setNotice("Empezaste otro servicio. El anterior se conserva en Mis servicios.");
 }
 function input():ServiceListingInput{return{title:form.title.trim(),description:form.description,category_id:form.category,service_mode:form.mode,pricing_mode:form.pricing,price:form.pricing==="QUOTE"?null:servicePrice(form.price),accepting_inquiries:form.accepting};}
 async function persist(withPhotos:boolean){
  const payload=input(),problem=serviceInputProblem(payload);
  if(problem)throw new Error(problem);
  if(!ws.categories.some(cat=>cat.id===payload.category_id&&cat.parent_id&&ws.categories.some(group=>group.id===cat.parent_id)))throw new Error("Elegí una especialidad activa.");
  const client=getSupabaseBrowserClient(),provider=ws.provider,id=base?.id??pendingId.current;
  if(!client||!provider||!id||!user)throw new Error();
  await assertServiceSession(client,user.id);if(!live.current)throw new Error();
  const changed=!base||JSON.stringify(inputOf(base))!==JSON.stringify(payload);
  if(changed){if(base)await updateServiceListing(client,provider.id,id,base.revision,payload);else await createServiceListing(client,provider.id,id,payload);}
  let current=await readMyServiceListing(client,id);
  const expected=base?base.revision+(changed?1:0):1;
  if(!current||current.provider_id!==provider.id||current.revision!==expected||JSON.stringify(inputOf(current))!==JSON.stringify(payload))throw new Error("La información cambió. Volvé a cargar antes de guardar.");
  if(live.current)setBase(current);
  if(withPhotos){
   const paths=await photo.upload(client,"listings",id,()=>assertServiceSession(client,user.id)),previous=current.images.map(item=>item.object_path);
   await assertServiceSession(client,user.id);if(!live.current)throw new Error();
   if(paths.length!==previous.length||paths.some((path,index)=>path!==previous[index])){
    const result=await saveServiceListingPhotos(client,current,paths);
    if(!result.success||!result.current)throw new Error(result.message);current=result.current;
    if(result.pendingCleanup.length&&live.current)setNotice("Hay fotos anteriores pendientes de limpieza; podés revisarlas debajo.");
   }
   if(live.current)photo.reset(current.images.map(item=>item.object_path));
  }
  if(live.current){setBase(current);ws.setProvider(current.provider);}
  return current;
 }
 async function operate(action:"next"|"save"|"publish"|"recover"){
  if(lock.current||disabled)return;
  if(action!=="recover"){const problem=serviceInputProblem(input());if(problem){setError(problem);return;}}
  if(action==="publish"&&ws.provider){const problem=providerPublishProblem(ws.provider);if(problem){setError(problem);return;}}
  lock.current=true;setBusy(true);setError("");setNotice("");
  try{
   if(action==="recover"){
    const client=getSupabaseBrowserClient(),id=base?.id;if(!client||!id)throw new Error();
    const paths=await readUnattachedServicePhotos(client,"listings",id),existing=new Set(photo.photos.flatMap(item=>item.path?[item.path]:[]));
    const available=paths.filter(path=>!existing.has(path)).slice(0,5-photo.photos.length);
    photo.change([...photo.photos,...available.map(path=>({key:path,path,localUrl:null,photo:null}))]);
    setNotice(available.length?"Fotos temporales recuperadas. Revisalas y guardá para vincularlas. No limpies temporales desde otra pestaña.":paths.some(path=>!existing.has(path))?"Hay fotos temporales, pero ya tenés cinco seleccionadas. Quitá alguna para recuperar otras.":"No hay fotos temporales adicionales para recuperar.");return;
   }
   const current=await persist(step>=2||action==="save"||action==="publish");
   if(action==="publish"){
    const problem=providerPublishProblem(current.provider);if(problem)throw new Error(problem);
    if(current.admin_blocked||current.status==="WITHDRAWN")throw new Error("Este servicio no se puede publicar.");
    const client=getSupabaseBrowserClient();if(!client||!user)throw new Error();
    await assertServiceSession(client,user.id);if(!live.current)throw new Error();
    let published=current;
    if(current.status!=="PUBLISHED"){await manageServiceListing(client,current.id,current.revision,"publish");const checked=await readMyServiceListing(client,current.id);if(!checked||checked.status!=="PUBLISHED"||checked.revision!==current.revision+1)throw new Error("La información cambió. Volvé a cargar antes de guardar.");published=checked;}
    else {const checked=await readMyServiceListing(client,current.id);if(!checked||checked.revision!==current.revision||checked.status!=="PUBLISHED")throw new Error("La información cambió. Volvé a cargar antes de guardar.");published=checked;}
    if(published.admin_blocked||providerPublishProblem(published.provider)||!await readPublicServiceListing(client,published.id))throw new Error("No pudimos confirmar que el servicio siga disponible. Volvé a cargar.");
    if(live.current){setBase(published);setSuccess(true);}if(user&&!listingId)rememberServiceId("listing",user.id,null);
   }else if(live.current){if(action==="next")setStep(value=>Math.min(3,value+1));setNotice("Borrador y cambios guardados.");}
  }catch(cause){
   // Reconciliar la existencia sin adoptar otra revisión ni prometer éxito propio.
   // El UUID no cambia y el editor sigue bloqueado hasta una recarga explícita.
   try{const client=getSupabaseBrowserClient(),id=base?.id??pendingId.current;
    if(client&&id&&user&&live.current){await assertServiceSession(client,user.id);const saved=await readMyServiceListing(client,id);if(saved&&live.current)setNotice("Hay una versión guardada de este servicio. Recargala para revisar sus datos y fotos antes de continuar.");}
   }catch{/* Si no se puede leer, conservar el UUID y no compensar con borrados. */}
   if(live.current){setError(serviceUiError(cause));setFrozen(true);}
  }finally{lock.current=false;if(live.current)setBusy(false);}
 }
 if(ws.error)return <section className="panel"><FormError message={ws.error}/><button className="outline-button" onClick={()=>{initialized.current=false;ws.reload();}}>Reintentar</button></section>;
 if(ws.loading||loading)return <p role="status">Preparando tu servicio…</p>;
 if(!ws.provider&&listingId)return <section className="panel"><h1>Este servicio no está disponible para tu cuenta.</h1><Link href="/mis-servicios">Mis servicios</Link></section>;
 if(!ws.provider)return <ProfessionalProfile continueToService onContinue={()=>{initialized.current=false;setLoading(true);ws.reload();}}/>;
 if(missing)return <section className="panel"><h1>Este servicio no está disponible para tu cuenta.</h1><Link href="/mis-servicios">Mis servicios</Link></section>;
 if(success&&base)return <section className={`panel ${styles.success}`}><h1>{listingId?"Tu servicio está actualizado.":"¡Tu servicio ya está publicado!"}</h1><div className={styles.actions}><Link className="primary-button" href={`/servicio/${base.id}`}>Ver servicio</Link><Link className="outline-button" href="/mis-servicios">Mis servicios</Link></div></section>;
 if(terminal&&base)return <><BackLink href="/mis-servicios">Mis servicios</BackLink><p className={styles.notice}>Servicio retirado. Este registro es de sólo lectura y no puede reactivarse.</p>{!listingId&&<button className="outline-button" disabled={busy||ws.suspended||blocked} onClick={startAnother}>Crear otro servicio</button>}<ServicePresentation listing={base} urls={signed.urls} privateView/></>;
 return <div className={styles.wizard}><BackLink href="/mis-servicios">Mis servicios</BackLink><div className={styles.heading}><span className="eyebrow">TU OFICIO, CERCA</span><h1>{listingId?"Editar mi servicio":"Ofrecé tu servicio"}</h1><p>Contá qué hacés y coordiná directamente con quienes te consulten.</p></div>
 {ws.suspended&&<p className="form-error">Tu cuenta está suspendida; no podés modificar servicios.</p>}{blocked&&<p className="form-error">Hay un bloqueo administrativo. {base?.admin_block_reason??ws.provider.admin_block_reason}</p>}
 <FormError message={error}/>{notice&&<p className={styles.notice} role="status">{notice}</p>}{base?.status==="PUBLISHED"&&<p className={styles.notice}>Tu servicio está publicado. Los cambios se aplican al guardar. Podés pausarlo desde <Link className="secondary-link" href="/mis-servicios">Mis servicios</Link>.</p>}{frozen&&<p className={styles.notice}>Revisá los datos y fotos guardados antes de continuar. <button className="outline-button" type="button" disabled={busy} onClick={reload}>Recargar publicación (descarta cambios locales)</button></p>}
 {!listingId&&base&&<div className={styles.notice}>La publicación recuperada se conserva en Mis servicios. Si tenés cambios locales, guardalos antes de empezar otra.<br/><button type="button" className="outline-button" disabled={disabled} onClick={startAnother}>Crear otro servicio</button></div>}
 <ol className={styles.progress} aria-label="Pasos para publicar">{["Servicio","Modalidad y precio","Fotos opcionales","Revisar"].map((title,index)=><li key={title} aria-current={index===step?"step":undefined} data-done={index<step}><b>{index+1}</b>{title}</li>)}</ol>
 <form className={`panel ${styles.formPanel}`} noValidate onSubmit={event=>{event.preventDefault();void operate(step===3?"publish":"next");}} aria-busy={busy}><fieldset disabled={disabled}><legend>{["¿Qué servicio ofrecés?","Cómo trabajás y cuánto cuesta","Mostrá tus trabajos","Así se verá tu servicio"][step]}</legend>
 {step===0&&<><label className={styles.field}>Título<input maxLength={160} required placeholder="Ej. Instalaciones eléctricas domiciliarias" value={form.title} onChange={event=>setForm({...form,title:event.target.value})}/></label><label className={styles.field}>Especialidad<select required value={form.category} onChange={event=>setForm({...form,category:event.target.value})}><option value="">Elegí una especialidad</option>{form.category&&!ws.categories.some(cat=>cat.id===form.category)&&<option value={form.category}>Categoría no disponible</option>}{ws.categories.filter(cat=>cat.parent_id===null).map(group=><optgroup key={group.id} label={group.name}>{ws.categories.filter(cat=>cat.parent_id===group.id).map(cat=><option key={cat.id} value={cat.id}>{cat.name}</option>)}</optgroup>)}</select></label><label className={styles.field}>Descripción<textarea maxLength={5000} value={form.description} placeholder="Explicá qué trabajos realizás y qué incluye el servicio." onChange={event=>setForm({...form,description:event.target.value})}/></label></>}
 {step===1&&<><label className={styles.field}>Modalidad<select value={form.mode} onChange={event=>setForm({...form,mode:event.target.value==="REMOTE"?"REMOTE":event.target.value==="AT_PROVIDER"?"AT_PROVIDER":"ONSITE"})}>{Object.entries(serviceModeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className={styles.field}>Precio<select value={form.pricing} onChange={event=>setForm({...form,pricing:event.target.value==="FIXED"?"FIXED":event.target.value==="FROM"?"FROM":"QUOTE"})}><option value="QUOTE">A presupuestar</option><option value="FIXED">Precio fijo</option><option value="FROM">Precio desde</option></select></label>{form.pricing!=="QUOTE"&&<label className={styles.field}>Importe en pesos argentinos<input inputMode="decimal" value={form.price} placeholder="Ej. 15000" onChange={event=>setForm({...form,price:event.target.value})}/><small>Positivo, hasta dos decimales. Sin separador de miles.</small></label>}<label className={styles.check}><input type="checkbox" checked={form.accepting} onChange={event=>setForm({...form,accepting:event.target.checked})}/><span>Estoy aceptando consultas</span></label><p className={styles.hint}>Si no aceptás consultas, el servicio puede seguir visible pero su detalle no mostrará WhatsApp.</p></>}
 {step===2&&<><ServicePhotos photos={photo.photos} disabled={disabled} preparing={photo.preparing} onAdd={files=>void photo.add(files)} onChange={photo.change}/><FormError message={photo.error}/>{base&&<button className="secondary-link" type="button" disabled={disabled} onClick={()=>void operate("recover")}>Recuperar fotos temporales de un intento anterior</button>}</>}
 {step===3&&base&&<><ServicePresentation listing={base} urls={signed.urls} privateView/>{signed.error&&<p className={styles.hint}>{signed.error}<button type="button" className="secondary-link" onClick={signed.refresh}>Reintentar fotos</button></p>}{providerPublishProblem(base.provider)&&<p className={styles.notice}>{providerPublishProblem(base.provider)} <Link className="secondary-link" href="/mi-perfil-profesional">Completar perfil profesional</Link></p>}</>}
 </fieldset><div className={styles.wizardActions}><div className={styles.actions}>{step>0&&<button className="outline-button" type="button" disabled={busy||photo.preparing} onClick={()=>setStep(value=>value-1)}>{step===3?"Volver a editar":"Anterior"}</button>}<button className="outline-button" type="button" disabled={disabled} onClick={()=>void operate("save")}>Guardar borrador y cambios</button></div><button className="primary-button" disabled={disabled||step===3&&!!providerPublishProblem(ws.provider)}>{busy?"Guardando…":step===3?base?.status==="PUBLISHED"?"Guardar publicación":"Publicar servicio":"Guardar y continuar"}</button></div></form>
 {base&&<ServicePhotoCleanup id={base.id} kind="listings" disabled={disabled||photo.photos.some(item=>!item.path||!base.images.some(image=>image.object_path===item.path))}/>}
 </div>;
}


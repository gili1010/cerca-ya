"use client";
import detailStyles from "@/components/details/public-details.module.css";
import {LoadingState} from "@/components/ui/primitives";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {readServiceSearchContext,servicePublicHref} from "@/lib/services/search-navigation";
import {useEffect,useState} from "react";
import type {PublicServiceProvider,PublicServiceListing,ServicePage} from "@/types/services";
import {readPublicServiceProvider,readServiceListings} from "@/lib/services/client";
import {getSupabaseBrowserClient} from "@/lib/supabase/client";
import {BackLink} from "@/components/navigation/back-link";
import {useUserLocation} from "@/components/location/user-location-provider";
import {normalizePlace} from "@/lib/argentina-provinces";
import {usePublicServiceRecord} from "./use-public-service-record";
import {useSignedServicePhotos} from "./use-signed-service-photos";
import {ProviderPresentation} from "./service-presentation";
import {ServiceCard} from "./service-card";
import {ServiceReport} from "./service-report";
import styles from "@/components/personal-listings/personal-listings.module.css";
import serviceStyles from "./services.module.css";
export function PublicProvider({initial}:{initial:PublicServiceProvider}){
 const params=useSearchParams(),context=readServiceSearchContext(new URLSearchParams(params.toString()));
 const resource=usePublicServiceRecord(initial,initial.id,readPublicServiceProvider),provider=resource.data;
 const signed=useSignedServicePhotos(provider?.avatar_path?[provider.avatar_path]:[]);
 return <><BackLink href={context.returnTo}>Volver a resultados</BackLink>{resource.checking?<LoadingState label="Comprobando disponibilidad…"/>:provider?<><ProviderPresentation publicDetail provider={provider} urls={signed.urls} contactEnabled={!(context.locality||context.province)||provider.areas.some(area=>area.province_code===context.province&&normalizePlace(area.city)===normalizePlace(context.locality))}/>{signed.error&&<p className={styles.hint}>{signed.error}<button className="secondary-link" onClick={signed.refresh}>Reintentar foto</button></p>}<ProviderServices provider={provider}/><ServiceReport entity="provider" id={provider.id}/></>:<section className={`${detailStyles.page} ${detailStyles.summary}`}><h1>Prestador no disponible.</h1><p>{resource.error||"Este perfil no está disponible públicamente."}</p><button className="outline-button" onClick={()=>void resource.refresh()}>Volver a comprobar</button><Link className="secondary-link" href="/">Volver a CercaYa</Link></section>}</>;
}
function ProviderServices({provider}:{provider:PublicServiceProvider}){
 const params=useSearchParams(),context=readServiceSearchContext(new URLSearchParams(params.toString()));
 const rawPage=params.get("provider_page")??"0",page=/^\d+$/.test(rawPage)?Math.min(Number(rawPage),100000):0;
 const scoped=Boolean(context.locality||context.province);
 function updateScope(city:string,province:string,nextPage:number){const next=new URLSearchParams(window.location.search);next.set("service_locality",city);next.set("service_province",province);next.set("provider_page",String(nextPage));window.history.replaceState(null,"",`${window.location.pathname}?${next}`);}
 const {locality,provinceCode}=useUserLocation(),[attempt,setAttempt]=useState(0),[response,setResponse]=useState<{key:string;data:ServicePage<PublicServiceListing>}|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const requestedCity=scoped?context.locality:locality??"",requestedProvince=scoped?context.province:provinceCode??"";
 const hasRequestedPlace=Boolean(requestedCity||requestedProvince);
 const area=hasRequestedPlace?provider.areas.find(item=>item.province_code===requestedProvince&&normalizePlace(item.city)===normalizePlace(requestedCity)):provider.areas[0];
 const setPage=(value:number|((previous:number)=>number))=>{if(area)updateScope(area.city,area.province_code,typeof value==="function"?value(page):value);};
 const key=JSON.stringify({provider:provider.id,city:area?.city,province:area?.province_code,requestedCity,requestedProvince,page});
 const data=response?.key===key?response.data:null;
 useEffect(()=>{let live=true;const controller=new AbortController();setLoading(true);setResponse(null);async function load(){if(!area){if(live){setLoading(false);setError(hasRequestedPlace?`El prestador no declara cobertura en ${requestedCity||"la localidad elegida"}. Elegí otra localidad de su cobertura.`:"El prestador todavía no declaró cobertura.");}return;}try{const client=getSupabaseBrowserClient();if(!client)throw new Error();const result=await readServiceListings(client,{providerId:provider.id,locality:area.city,provinceCode:area.province_code,page},controller.signal);if(live){if(page>Math.max(0,Math.ceil(result.total/24)-1)){setPage(Math.max(0,Math.ceil(result.total/24)-1));return;}setResponse({key,data:result});setError("");}}catch{if(live)setError("No pudimos cargar los servicios disponibles. Volvé a intentar.");}finally{if(live)setLoading(false);}}void load();return()=>{live=false;controller.abort();};},[key,attempt,provider.id,area?.city,area?.province_code,page,hasRequestedPlace,requestedCity]);
 const signed=useSignedServicePhotos(data?.items.flatMap(row=>row.images[0]?[row.images[0].object_path]:[])??[]);
 return <section style={{marginTop:"var(--space-6)"}} aria-labelledby="provider-services-title"><h2 id="provider-services-title">Servicios disponibles</h2><div className={serviceStyles.coverage}><label>Ver servicios en una localidad de su cobertura<select value={area?.id??""} onChange={event=>{const next=provider.areas.find(item=>item.id===event.target.value);if(next)updateScope(next.city,next.province_code,0);}}>{!area&&<option value="">Sin cobertura en la localidad elegida</option>}{provider.areas.map(item=><option key={item.id} value={item.id}>{item.city}, {item.province}</option>)}</select></label><p className={styles.hint}>Consultamos sólo este prestador y la localidad seleccionada. No hay búsqueda nacional ni distancia calculada.</p></div>{loading?<p role="status">Cargando servicios…</p>:error?<p role="alert">{error}<button className="outline-button" onClick={()=>setAttempt(v=>v+1)}>Reintentar</button></p>:data?.items.length?<><p role="status" className={styles.hint}>{data.total} servicios en {area?.city}</p><div className={styles.listingGrid}>{data.items.map(row=><ServiceCard key={row.id} listing={row} urls={signed.urls} detailHref={servicePublicHref("servicio",row.id,{...context,locality:area?.city??"",province:area?.province_code??""})} providerHref={servicePublicHref("prestador",provider.id,{...context,locality:area?.city??"",province:area?.province_code??""})}/>)}</div></>:<p className={styles.notice}>No hay servicios disponibles en esta localidad.</p>}{signed.error&&<p className={styles.hint}>{signed.error}<button className="secondary-link" onClick={signed.refresh}>Reintentar fotos</button></p>}{data&&data.total>24&&<nav className={styles.pagination} aria-label="Páginas de servicios del prestador"><button className="outline-button" disabled={loading||page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>{page+1} / {Math.ceil(data.total/24)}</span><button className="outline-button" disabled={loading||(page+1)*24>=data.total} onClick={()=>setPage(v=>v+1)}>Siguiente</button></nav>}</section>;
}


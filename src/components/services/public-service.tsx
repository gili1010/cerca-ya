"use client";
import Link from "next/link";
import {useSearchParams} from "next/navigation";
import {readServiceSearchContext,servicePublicHref} from "@/lib/services/search-navigation";
import {normalizePlace} from "@/lib/argentina-provinces";
import type {PublicServiceListing} from "@/types/services";
import {readPublicServiceListing} from "@/lib/services/client";
import {BackLink} from "@/components/navigation/back-link";
import {ServicePresentation} from "./service-presentation";
import {ServiceReport} from "./service-report";
import {usePublicServiceRecord} from "./use-public-service-record";
import {useSignedServicePhotos} from "./use-signed-service-photos";
import styles from "@/components/personal-listings/personal-listings.module.css";
export function PublicService({initial}:{initial:PublicServiceListing}){
 const params=useSearchParams(),context=readServiceSearchContext(new URLSearchParams(params.toString()));
 const resource=usePublicServiceRecord(initial,initial.id,readPublicServiceListing),listing=resource.data;
 const signed=useSignedServicePhotos(listing?[...listing.images.map(image=>image.object_path),...(listing.provider.avatar_path?[listing.provider.avatar_path]:[])]:[]);
 const scoped=Boolean(context.locality||context.province);
 const covered=!scoped||Boolean(listing?.provider.areas.some(area=>area.province_code===context.province&&normalizePlace(area.city)===normalizePlace(context.locality)));
 return <><BackLink href={context.returnTo}>Volver a los resultados</BackLink>{resource.checking?<p role="status">Comprobando disponibilidad…</p>:listing?<>{!covered&&<p className={styles.notice}>Este prestador ya no declara cobertura en {context.locality}. Revisá sus localidades de trabajo.</p>}<ServicePresentation listing={listing} urls={signed.urls} contactEnabled={covered} providerHref={servicePublicHref("prestador",listing.provider_id,context)}/>{signed.error&&<p className={styles.hint}>{signed.error}<button className="secondary-link" onClick={signed.refresh}>Reintentar fotos</button></p>}<ServiceReport entity="listing" id={listing.id}/></>:<section className="panel"><h1>Servicio no disponible.</h1><p>{resource.error||"Puede estar pausado, retirado o no estar disponible públicamente."}</p><button className="outline-button" onClick={()=>void resource.refresh()}>Volver a comprobar</button><Link className="secondary-link" href="/">Volver a CercaYa</Link></section>}</>;
}


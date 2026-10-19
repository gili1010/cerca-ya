import detailStyles from "@/components/details/public-details.module.css";
import {BackLink} from "@/components/navigation/back-link";
import {readServiceSearchContext,servicePublicHref} from "@/lib/services/search-navigation";
import {notFound} from "next/navigation";
import Link from "next/link";
import {isServiceId} from "@/lib/services/contracts";
import {getPublicServiceListing} from "@/lib/services/server";
import {PersonalShell as ServiceShell} from "@/components/personal-listings/personal-shell";
import {PublicService} from "@/components/services/public-service";
import type {PublicServiceListing} from "@/types/services";
export const dynamic="force-dynamic";
export const metadata={title:"Servicio | CercaYa"};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=new URLSearchParams();for(const [key,value] of Object.entries(await searchParams)){if(typeof value==="string")query.set(key,value);}const context=readServiceSearchContext(query);
 const {id}=await params;if(!isServiceId(id))notFound();let listing:PublicServiceListing|null;
 try{listing=await getPublicServiceListing(id);}catch{return <ServiceShell><section className={`${detailStyles.page} ${detailStyles.summary}`}><h1>No pudimos cargar el servicio.</h1><p>Volvé a intentar en unos momentos.</p><Link className="primary-button" href={servicePublicHref("servicio",id,context)}>Reintentar</Link><BackLink href={context.returnTo}>Volver a resultados</BackLink></section></ServiceShell>;}
 if(!listing)notFound();return <ServiceShell><PublicService key={listing.id} initial={listing}/></ServiceShell>;
}


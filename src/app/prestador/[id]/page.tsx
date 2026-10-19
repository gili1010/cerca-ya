import detailStyles from "@/components/details/public-details.module.css";
import {BackLink} from "@/components/navigation/back-link";
import {readServiceSearchContext,servicePublicHref} from "@/lib/services/search-navigation";
import {notFound} from "next/navigation";
import Link from "next/link";
import {isServiceId} from "@/lib/services/contracts";
import {getPublicServiceProvider} from "@/lib/services/server";
import {PersonalShell as ServiceShell} from "@/components/personal-listings/personal-shell";
import {PublicProvider} from "@/components/services/public-provider";
import type {PublicServiceProvider} from "@/types/services";
export const dynamic="force-dynamic";
export const metadata={title:"Prestador de servicios | CercaYa"};
export default async function Page({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const query=new URLSearchParams();for(const [key,value] of Object.entries(await searchParams)){if(typeof value==="string")query.set(key,value);}const context=readServiceSearchContext(query);
 const {id}=await params;if(!isServiceId(id))notFound();let provider:PublicServiceProvider|null;
 try{provider=await getPublicServiceProvider(id);}catch{return <ServiceShell><section className={`${detailStyles.page} ${detailStyles.summary}`}><h1>No pudimos cargar el prestador.</h1><p>Volvé a intentar en unos momentos.</p><Link className="primary-button" href={servicePublicHref("prestador",id,context)}>Reintentar</Link><BackLink href={context.returnTo}>Volver a resultados</BackLink></section></ServiceShell>;}
 if(!provider)notFound();return <ServiceShell><PublicProvider key={provider.id} initial={provider}/></ServiceShell>;
}


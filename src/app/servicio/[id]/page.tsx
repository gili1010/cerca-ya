import {notFound} from "next/navigation";
import Link from "next/link";
import {isServiceId} from "@/lib/services/contracts";
import {getPublicServiceListing} from "@/lib/services/server";
import {ServiceShell} from "@/components/services/service-shell";
import {PublicService} from "@/components/services/public-service";
import type {PublicServiceListing} from "@/types/services";
export const dynamic="force-dynamic";
export const metadata={title:"Servicio | CercaYa"};
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!isServiceId(id))notFound();let listing:PublicServiceListing|null;
 try{listing=await getPublicServiceListing(id);}catch{return <ServiceShell><section className="panel"><h1>No pudimos cargar el servicio.</h1><p>Volvé a intentar en unos momentos.</p><Link className="primary-button" href={`/servicio/${id}`}>Reintentar</Link></section></ServiceShell>;}
 if(!listing)notFound();return <ServiceShell><PublicService key={listing.id} initial={listing}/></ServiceShell>;
}


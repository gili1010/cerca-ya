import {notFound} from "next/navigation";
import Link from "next/link";
import {isServiceId} from "@/lib/services/contracts";
import {getPublicServiceProvider} from "@/lib/services/server";
import {ServiceShell} from "@/components/services/service-shell";
import {PublicProvider} from "@/components/services/public-provider";
import type {PublicServiceProvider} from "@/types/services";
export const dynamic="force-dynamic";
export const metadata={title:"Prestador de servicios | CercaYa"};
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!isServiceId(id))notFound();let provider:PublicServiceProvider|null;
 try{provider=await getPublicServiceProvider(id);}catch{return <ServiceShell><section className="panel"><h1>No pudimos cargar el prestador.</h1><p>Volvé a intentar en unos momentos.</p><Link className="primary-button" href={`/prestador/${id}`}>Reintentar</Link></section></ServiceShell>;}
 if(!provider)notFound();return <ServiceShell><PublicProvider key={provider.id} initial={provider}/></ServiceShell>;
}


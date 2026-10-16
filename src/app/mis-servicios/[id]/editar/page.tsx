import {notFound} from "next/navigation";
import {isServiceId} from "@/lib/services/contracts";
import {ServiceShell} from "@/components/services/service-shell";
import {ServiceAuthGate} from "@/components/services/service-auth-gate";
import {ServiceEditor} from "@/components/services/service-editor";
export const metadata={title:"Editar mi servicio | CercaYa"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!isServiceId(id))notFound();return <ServiceShell><ServiceAuthGate returnTo={`/mis-servicios/${id}/editar`}><ServiceEditor key={id} listingId={id}/></ServiceAuthGate></ServiceShell>;}


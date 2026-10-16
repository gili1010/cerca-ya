import {RadarFrame} from "@/components/service-radar/radar-common";
import {ServiceOpportunity} from "@/components/service-radar/radar-details";
import {notFound} from "next/navigation";
import {isServiceId} from "@/lib/services/contracts";
export const dynamic="force-dynamic";
export const metadata={title:"Oportunidad de servicio | CercaYa"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!isServiceId(id))notFound();return <RadarFrame><ServiceOpportunity key={id} id={id}/></RadarFrame>;}

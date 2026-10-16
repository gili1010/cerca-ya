import {RadarFrame} from "@/components/service-radar/radar-common";
import {BuyerServiceRequest} from "@/components/service-radar/radar-details";
import {notFound} from "next/navigation";
import {isServiceId} from "@/lib/services/contracts";
export const dynamic="force-dynamic";
export const metadata={title:"Mi solicitud de servicio | CercaYa"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!isServiceId(id))notFound();return <RadarFrame><BuyerServiceRequest key={id} id={id}/></RadarFrame>;}

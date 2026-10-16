import {RadarFrame} from "@/components/service-radar/radar-common";
import {RequestEditor} from "@/components/service-radar/request-editor";
import {notFound} from "next/navigation";
import {isServiceId} from "@/lib/services/contracts";
export const dynamic="force-dynamic";
export const metadata={title:"Editar solicitud | CercaYa"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!isServiceId(id))notFound();return <RadarFrame><RequestEditor key={id} id={id}/></RadarFrame>;}

import {RadarFrame} from "@/components/service-radar/radar-common";
import {MyServiceRequests} from "@/components/service-radar/radar-lists";
export const dynamic="force-dynamic";
export const metadata={title:"Mis solicitudes de servicios | CercaYa"};
export default function Page(){return <RadarFrame><MyServiceRequests/></RadarFrame>;}

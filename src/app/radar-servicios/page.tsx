import {RadarFrame} from "@/components/service-radar/radar-common";
import {ServiceRadarList} from "@/components/service-radar/radar-lists";
export const dynamic="force-dynamic";
export const metadata={title:"Radar de servicios | CercaYa"};
export default function Page(){return <RadarFrame><ServiceRadarList/></RadarFrame>;}

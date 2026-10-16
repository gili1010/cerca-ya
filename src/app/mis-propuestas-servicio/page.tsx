import {RadarFrame} from "@/components/service-radar/radar-common";
import {MyServiceProposals} from "@/components/service-radar/radar-lists";
export const dynamic="force-dynamic";
export const metadata={title:"Mis propuestas | CercaYa"};
export default function Page(){return <RadarFrame><MyServiceProposals/></RadarFrame>;}

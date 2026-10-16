import {RadarFrame} from "@/components/service-radar/radar-common";
import {RequestEditor} from "@/components/service-radar/request-editor";
export const dynamic="force-dynamic";
export const metadata={title:"Necesito un servicio | CercaYa"};
export default function Page(){return <RadarFrame><RequestEditor/></RadarFrame>;}

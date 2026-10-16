import {ServiceShell} from "@/components/services/service-shell";
import {ServiceAuthGate} from "@/components/services/service-auth-gate";
import {ServiceEditor} from "@/components/services/service-editor";
export const metadata={title:"Ofrecer un servicio | CercaYa"};
export default function Page(){return <ServiceShell><ServiceAuthGate returnTo="/publicar/servicio"><ServiceEditor/></ServiceAuthGate></ServiceShell>;}


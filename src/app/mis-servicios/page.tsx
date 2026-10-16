import {ServiceShell} from "@/components/services/service-shell";
import {ServiceAuthGate} from "@/components/services/service-auth-gate";
import {MyServices} from "@/components/services/my-services";
export const metadata={title:"Mis servicios | CercaYa"};
export default function Page(){return <ServiceShell><ServiceAuthGate returnTo="/mis-servicios"><MyServices/></ServiceAuthGate></ServiceShell>;}


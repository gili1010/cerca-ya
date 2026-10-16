import {ServiceShell} from "@/components/services/service-shell";
import {ServiceAuthGate} from "@/components/services/service-auth-gate";
import {ProfessionalProfile} from "@/components/services/professional-profile";
export const metadata={title:"Mi perfil profesional | CercaYa"};
export default function Page(){return <ServiceShell><ServiceAuthGate returnTo="/mi-perfil-profesional"><ProfessionalProfile/></ServiceAuthGate></ServiceShell>;}


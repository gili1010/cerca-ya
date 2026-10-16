import Link from "next/link";
import {ServiceShell} from "@/components/services/service-shell";
export default function NotFound(){return <ServiceShell><section className="panel"><h1>Prestador no disponible.</h1><p>Este perfil no está disponible públicamente.</p><Link className="primary-button" href="/">Volver a CercaYa</Link></section></ServiceShell>;}


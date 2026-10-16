import Link from "next/link";
import {ServiceShell} from "@/components/services/service-shell";
export default function NotFound(){return <ServiceShell><section className="panel"><h1>Servicio no disponible.</h1><p>Puede estar pausado, retirado o no estar disponible públicamente.</p><Link className="primary-button" href="/">Volver a CercaYa</Link></section></ServiceShell>;}


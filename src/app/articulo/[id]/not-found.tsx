import Link from "next/link";
import { PersonalShell } from "@/components/personal-listings/personal-shell";

export default function NotFound() {
  return <PersonalShell><section className="panel empty-state"><h1>Este artículo no está disponible.</h1><p>Puede haber sido vendido, pausado o retirado.</p><Link className="primary-button" href="/">Volver a CercaYa</Link></section></PersonalShell>;
}

import { Suspense } from "react";
import { DetailUnavailable } from "@/components/details/detail-unavailable";
import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { BackLink } from "@/components/navigation/back-link";

export default function NotFound() {
  return <PersonalShell><Suspense fallback={<BackLink href="/">Volver a resultados</BackLink>}><DetailUnavailable /></Suspense></PersonalShell>;
}

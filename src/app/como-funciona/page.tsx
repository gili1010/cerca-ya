import type { Metadata } from "next";
import { DetailShell } from "@/components/details/detail-shell";
import { HowItWorksGuide } from "@/components/how-it-works/how-it-works-guide";

export const metadata: Metadata = {
  title: "Cómo funciona CercaYa",
  description: "Descubrí cómo buscar cerca, hacer pedidos, recibir ofertas y llevar tu comercio a CercaYa.",
};

export default function HowItWorksPage() {
  return <DetailShell><HowItWorksGuide /></DetailShell>;
}

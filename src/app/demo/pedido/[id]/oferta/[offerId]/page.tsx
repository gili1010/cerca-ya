// Explicit legacy route keeps existing local reservation demos separate from real offers.
import { RequestShell } from "@/components/requests/request-shell";
import { OfferDetail } from "@/components/requests/offer-detail";
export const metadata = { title: "Oferta de prueba local | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string; offerId: string }> }) {
  const { id, offerId } = await params;
  return <RequestShell><OfferDetail requestId={id} offerId={offerId} /></RequestShell>;
}

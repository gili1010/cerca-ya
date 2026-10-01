import { RequestShell } from "@/components/requests/request-shell";
import { RealOfferDetail } from "@/components/requests/real-offers";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Detalle de oferta | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string; offerId: string }> }) {
  const { id, offerId } = await params;
  const returnTo = `/pedido/${encodeURIComponent(id)}/oferta/${encodeURIComponent(offerId)}`;
  await requireUser(returnTo);
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}><RealOfferDetail key={`${id}:${offerId}`} requestId={id} offerId={offerId} /></RequireAuth></RequestShell>;
}

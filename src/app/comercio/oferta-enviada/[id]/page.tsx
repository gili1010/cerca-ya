import { RequestShell } from "@/components/requests/request-shell";
import { RealOfferDetail } from "@/components/requests/real-offers";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Mi oferta | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = `/comercio/oferta-enviada/${encodeURIComponent(id)}`;
  await requireUser(returnTo);
  return <RequestShell business realRequests><RequireAuth returnTo={returnTo}><RealOfferDetail key={id} offerId={id} seller /></RequireAuth></RequestShell>;
}

import { RequestShell } from "@/components/requests/request-shell";
import { BuyerRequestDetail } from "@/components/requests/buyer-requests";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Pedido publicado | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = `/pedido/${encodeURIComponent(id)}/confirmacion`;
  await requireUser(returnTo);
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}><BuyerRequestDetail key={id} id={id} confirmation /></RequireAuth></RequestShell>;
}

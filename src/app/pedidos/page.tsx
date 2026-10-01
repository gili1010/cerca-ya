import { RequestShell } from "@/components/requests/request-shell";
import { BuyerRequestList } from "@/components/requests/buyer-requests";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Mis pedidos | CercaYa" };
export default async function Page() {
  await requireUser("/pedidos");
  return <RequestShell realRequests><RequireAuth returnTo="/pedidos"><BuyerRequestList /></RequireAuth></RequestShell>;
}

import { RequireAuth } from "@/components/auth/require-auth";
import { CartCheckout } from "@/components/cart/cart-checkout";
import { RequestShell } from "@/components/requests/request-shell";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Completá tu pedido | CercaYa" };

export default async function Page({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const returnTo = `/carrito/${encodeURIComponent(businessId)}/checkout`;
  await requireUser(returnTo);
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}><CartCheckout businessId={businessId} /></RequireAuth></RequestShell>;
}

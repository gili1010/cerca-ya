import { RequestShell } from "@/components/requests/request-shell";
import { RealOfferForm } from "@/components/requests/real-offer-form";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Responder a un pedido | CercaYa" };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ producto?: string | string[] }> }) {
  const { id } = await params;
  const { producto } = await searchParams;
  const productId = typeof producto === "string" ? producto : undefined;
  const returnTo = `/comercio/oportunidades/${encodeURIComponent(id)}/responder${productId ? `?producto=${encodeURIComponent(productId)}` : ""}`;
  await requireUser(returnTo);
  return <RequestShell business realRequests><RequireAuth returnTo={returnTo}><RealOfferForm key={`${id}:${productId ?? ""}`} requestId={id} productId={productId} /></RequireAuth></RequestShell>;
}

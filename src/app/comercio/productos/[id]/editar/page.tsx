import { notFound } from "next/navigation";
import { RequestShell } from "@/components/requests/request-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { MerchantProductForm } from "@/components/merchant-products/product-form";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Editar producto | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = `/comercio/productos/${encodeURIComponent(id)}/editar`;
  await requireUser(returnTo);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  return <RequestShell business><RequireAuth returnTo={returnTo}><MerchantProductForm productId={id} /></RequireAuth></RequestShell>;
}

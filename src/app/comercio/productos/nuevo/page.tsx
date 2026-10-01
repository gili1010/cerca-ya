import { RequestShell } from "@/components/requests/request-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { MerchantProductForm } from "@/components/merchant-products/product-form";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Publicar producto | CercaYa" };
export default async function Page() {
  await requireUser("/comercio/productos/nuevo");
  return <RequestShell business><RequireAuth returnTo="/comercio/productos/nuevo"><MerchantProductForm /></RequireAuth></RequestShell>;
}

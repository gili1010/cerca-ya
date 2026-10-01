import { RequestShell } from "@/components/requests/request-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { MerchantProductList } from "@/components/merchant-products/product-list";
import { requireUser } from "@/lib/auth/server";

export const metadata = { title: "Productos del comercio | CercaYa" };
export default async function Page() {
  await requireUser("/comercio/productos");
  return <RequestShell business><RequireAuth returnTo="/comercio/productos"><MerchantProductList /></RequireAuth></RequestShell>;
}

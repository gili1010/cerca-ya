import { DetailShell } from "@/components/details/detail-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { MyBusiness } from "@/components/businesses/my-business";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Mi comercio | CercaYa" };
export default async function Page() {
  await requireUser("/comercio/mi-negocio");
  return <DetailShell><RequireAuth returnTo="/comercio/mi-negocio"><MyBusiness /></RequireAuth></DetailShell>;
}

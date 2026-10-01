import { DetailShell } from "@/components/details/detail-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { BusinessForm } from "@/components/businesses/business-form";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Editar comercio | CercaYa" };
export default async function Page() {
  await requireUser("/comercio/editar");
  return <DetailShell><RequireAuth returnTo="/comercio/editar"><BusinessForm edit /></RequireAuth></DetailShell>;
}

import { DetailShell } from "@/components/details/detail-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
import { BusinessForm } from "@/components/businesses/business-form";
export const metadata = { title: "Vender en CercaYa" };
export default async function Page() {
  await requireUser("/comercio/crear");
  return <DetailShell><RequireAuth returnTo="/comercio/crear"><BusinessForm /></RequireAuth></DetailShell>;
}

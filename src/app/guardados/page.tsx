import { DetailShell } from "@/components/details/detail-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { SavedProducts } from "@/components/auth/saved-products";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Guardados | CercaYa" };
export default async function Page() {
  await requireUser("/guardados");
  return <DetailShell><RequireAuth returnTo="/guardados"><SavedProducts /></RequireAuth></DetailShell>;
}

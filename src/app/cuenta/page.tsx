import { DetailShell } from "@/components/details/detail-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { Account } from "@/components/auth/account";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Mi cuenta | CercaYa" };
export default async function Page() {
  await requireUser("/cuenta");
  return <DetailShell><RequireAuth returnTo="/cuenta"><Account /></RequireAuth></DetailShell>;
}

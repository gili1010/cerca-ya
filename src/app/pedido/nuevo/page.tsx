import { RequestShell } from "@/components/requests/request-shell";
import { NewRequest } from "@/components/requests/new-request";
import { requireUser } from "@/lib/auth/server";
import { RequireAuth } from "@/components/auth/require-auth";

export const metadata = { title: "Crear pedido abierto | CercaYa" };
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const title = typeof q === "string" ? q : "";
  const returnTo = `/pedido/nuevo${title ? `?q=${encodeURIComponent(title)}` : ""}`;
  await requireUser(returnTo);
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}><NewRequest initialTitle={title} /></RequireAuth></RequestShell>;
}

import { RequestShell } from "@/components/requests/request-shell";
import { Radar } from "@/components/radar/radar";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Radar CercaYa | CercaYa" };
export default async function Page() {
  await requireUser("/comercio/radar");
  return <RequestShell business realRequests><RequireAuth returnTo="/comercio/radar"><Radar /></RequireAuth></RequestShell>;
}

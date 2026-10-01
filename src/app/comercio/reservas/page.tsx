import { RequestShell } from "@/components/requests/request-shell";
import { ReservationList } from "@/components/reservations/reservation-list";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Reservas | CercaYa" };
export default async function Page() {
  const returnTo = "/comercio/reservas";
  await requireUser(returnTo);
  return <RequestShell realRequests business><RequireAuth returnTo={returnTo}><ReservationList business /></RequireAuth></RequestShell>;
}

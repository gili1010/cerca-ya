import { RequestShell } from "@/components/requests/request-shell";
import { ReservationDetail } from "@/components/reservations/reservation-detail";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Reservas | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = "/reserva/" + encodeURIComponent(id);
  await requireUser(returnTo);
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}><ReservationDetail key={id} id={id} /></RequireAuth></RequestShell>;
}

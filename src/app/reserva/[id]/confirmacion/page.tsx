import { RequestShell } from "@/components/requests/request-shell";
import { ReservationConfirmation } from "@/components/reservations/reservation-confirmation";
import { RequireAuth } from "@/components/auth/require-auth";
import { requireUser } from "@/lib/auth/server";
export const metadata = { title: "Reservas | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const returnTo = "/reserva/" + encodeURIComponent(id) + "/confirmacion";
  await requireUser(returnTo);
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}><ReservationConfirmation key={id} id={id} /></RequireAuth></RequestShell>;
}

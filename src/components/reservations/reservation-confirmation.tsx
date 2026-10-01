import { ReservationDetail } from "./reservation-detail";
export function ReservationConfirmation({ id }: { id: string }) {
  return <ReservationDetail id={id} confirmation />;
}

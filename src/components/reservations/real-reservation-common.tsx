import Link from "next/link";
import type { ReservationView } from "@/types/database";
import type { DeliveryType } from "@/types/reservations";
import { reservationStatus } from "@/lib/real-reservations";
import { placeholderImage } from "@/lib/public-catalog";
import { ReservationProduct, ReservationTotals, reservationDate, deliveryLabel } from "./reservation-common";

export function reservationDisplay(row: ReservationView, now: number) {
  const deliveryType: DeliveryType = row.delivery_type === "PICKUP" ? "pickup" : "delivery";
  return { status: reservationStatus(row, now), deliveryType, quantity: row.quantity, unitPrice: row.unit_price,
    deliveryPrice: row.delivery_price, total: row.total, createdAt: row.created_at, confirmedAt: row.confirmed_at,
    readyAt: row.ready_at, completedAt: row.completed_at };
}
export function RealReservationSummary({ row, now }: { row: ReservationView; now: number }) {
  const display = reservationDisplay(row, now);
  return <><ReservationProduct name={row.product_name} image={row.product_image ?? placeholderImage} business={row.business_name} productId={row.product_id} /><ReservationTotals {...display} />
    <dl className="request-facts"><div><dt>Número de reserva</dt><dd className="buyer-request-id">{row.id}</dd></div><div><dt>Modalidad</dt><dd>{deliveryLabel(display.deliveryType)}</dd></div><div><dt>Creada</dt><dd><time dateTime={row.created_at}>{reservationDate(row.created_at)}</time></dd></div></dl></>;
}
export function UnavailableReservation({ business = false }: { business?: boolean }) {
  return <section className="empty-state"><h1>Esta reserva no está disponible para tu cuenta.</h1><Link className="primary-button" href={business ? "/comercio/reservas" : "/reservas"}>Ver reservas</Link></section>;
}

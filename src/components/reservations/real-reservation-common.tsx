import Link from "next/link";
import type { ReservationView } from "@/types/database";
import type { DeliveryType } from "@/types/reservations";
import { reservationItems, reservationItemsSubtotal, reservationStatus } from "@/lib/real-reservations";
import { money } from "@/lib/products";
import { placeholderImage } from "@/lib/public-catalog";
import { ReservationProduct, reservationDate, deliveryLabel } from "./reservation-common";

export function reservationDisplay(row: ReservationView, now: number) {
  const deliveryType: DeliveryType = row.delivery_type === "PICKUP" ? "pickup" : "delivery";
  const items = reservationItems(row);
  return { status: reservationStatus(row, now), deliveryType, quantity: items.reduce((quantity, item) => quantity + item.quantity, 0), unitPrice: row.unit_price,
    itemCount: items.length, itemsSubtotal: reservationItemsSubtotal(row),
    deliveryPrice: row.delivery_price, total: row.total, createdAt: row.created_at, confirmedAt: row.confirmed_at,
    readyAt: row.ready_at, completedAt: row.completed_at };
}
export function RealReservationSummary({ row, now }: { row: ReservationView; now: number }) {
  const display = reservationDisplay(row, now);
  return <>{reservationItems(row).map(item => <div key={item.id}><ReservationProduct name={item.product_name_snapshot} image={item.product_image ?? placeholderImage} business={row.business_name} productId={item.product_id} /><p>{item.quantity} × {money(item.unit_price)} · {money(item.subtotal)}</p></div>)}
    <dl className="reservation-totals"><div><dt>Productos</dt><dd>{money(display.itemsSubtotal)}</dd></div><div><dt>{deliveryLabel(display.deliveryType)}</dt><dd>{display.deliveryPrice ? money(display.deliveryPrice) : "Sin costo"}</dd></div><div className="reservation-total"><dt>Total</dt><dd>{money(display.total)}</dd></div></dl>
    <dl className="request-facts"><div><dt>Número de reserva</dt><dd className="buyer-request-id">{row.id}</dd></div><div><dt>Modalidad</dt><dd>{deliveryLabel(display.deliveryType)}</dd></div><div><dt>Creada</dt><dd><time dateTime={row.created_at}>{reservationDate(row.created_at)}</time></dd></div></dl></>;
}
export function UnavailableReservation({ business = false }: { business?: boolean }) {
  return <section className="empty-state"><h1>Esta reserva no está disponible para tu cuenta.</h1><Link className="primary-button" href={business ? "/comercio/reservas" : "/reservas"}>Ver reservas</Link></section>;
}

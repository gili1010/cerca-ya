import Link from "next/link";
import { ArrowRight, Store, Truck } from "lucide-react";
import type { ReservationView } from "@/types/database";
import { money } from "@/lib/products";
import { placeholderImage } from "@/lib/public-catalog";
import { reservationItems } from "@/lib/real-reservations";
import { ProductImage } from "../details/product-image";
import { reservationDisplay } from "./real-reservation-common";
import { deliveryLabel, ReservationStatusBadge } from "./reservation-common";
import styles from "./buyer-reservations.module.css";

export function BuyerReservationCard({ row, now }: { row: ReservationView; now: number }) {
  const display = reservationDisplay(row, now);
  const items = reservationItems(row);
  const first = items[0];
  const DeliveryIcon = display.deliveryType === "pickup" ? Store : Truck;

  return <article className={styles.card}>
    <div className={styles.topline}>
      <span className={styles.identifier} title={row.id}>Reserva #{row.id.slice(0, 8)}</span>
      <ReservationStatusBadge reservation={display} />
    </div>
    <div className={styles.product}>
      <div className={styles.image}><ProductImage src={first.product_image ?? placeholderImage} alt={first.product_name_snapshot} /></div>
      <div className={styles.productInfo}>
        <Link className={styles.productName} href={`/producto/${first.product_id}`}>{first.product_name_snapshot}</Link>
        <p className={styles.business}>{row.business_name}</p>
        {items.length > 1 && <span className={styles.extra}>+{items.length - 1} {items.length === 2 ? "producto más" : "productos más"}</span>}
      </div>
    </div>
    <dl className={styles.summary}>
      <div><dt>Cantidad</dt><dd>{display.quantity} {display.quantity === 1 ? "unidad" : "unidades"}</dd></div>
      <div className={styles.total}><dt>Total</dt><dd>{money(row.total)}</dd></div>
    </dl>
    <div className={styles.delivery}><DeliveryIcon size={17} aria-hidden="true" /><span>{deliveryLabel(display.deliveryType)}</span></div>
    <footer className={styles.footer}>
      <time dateTime={row.created_at} title="Fecha de creación de la reserva">{new Date(row.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</time>
      <Link className={styles.detailLink} href={`/reserva/${row.id}`} aria-label={`Ver reserva de ${first.product_name_snapshot}, ${row.business_name}`}>Ver reserva<ArrowRight size={16} aria-hidden="true" /></Link>
    </footer>
  </article>;
}

import Link from "next/link";
import { Check, Circle, Package, Store, Truck } from "lucide-react";
import { money } from "@/lib/products";
import { placeholderImage } from "@/lib/public-catalog";
import { reservationItems, reservationItemsSubtotal } from "@/lib/real-reservations";
import type { ReservationView } from "@/types/database";
import type { ReservationStatus } from "@/types/reservations";
import { ProductImage } from "../details/product-image";
import type { reservationDisplay } from "./real-reservation-common";
import { reservationDate } from "./reservation-common";
import styles from "./reservation-detail.module.css";

type OrderDisplay = ReturnType<typeof reservationDisplay>;

const statusLabels: Record<ReservationStatus, string> = {
  PENDING: "Esperando confirmación",
  CONFIRMED: "Confirmado",
  READY: "Listo para retirar",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  EXPIRED: "Vencido",
};

export function OrderStatusBadge({ display }: { display: OrderDisplay }) {
  return <span className={`reservation-status status-${display.status.toLowerCase()}`} role="status">
    <i aria-hidden="true" />
    {display.status === "READY" && display.deliveryType === "delivery" ? "Listo para enviar" : statusLabels[display.status]}
  </span>;
}

export function ReservationOrderSummary({ row }: { row: ReservationView }) {
  const items = reservationItems(row);
  return <section className={styles.products} aria-labelledby="order-products-title">
    <h2 id="order-products-title" className={styles.sectionTitle}><Package size={19} aria-hidden="true" />Productos</h2>
    {items.map(item => <div className={styles.productLine} key={item.id}>
      <ProductImage className={styles.productImage} src={item.product_image ?? placeholderImage} alt={item.product_name_snapshot} />
      <div className={styles.productInfo}>
        <Link href={`/producto/${item.product_id}`}>{item.product_name_snapshot}</Link>
        <p>{item.quantity} × {money(item.unit_price)}</p>
        {item.inventory_mode_snapshot === "ON_DEMAND" && <p>Se prepara a pedido</p>}
      </div>
      <strong className={styles.subtotal}><span className={styles.srOnly}>Subtotal: </span>{money(item.subtotal)}</strong>
    </div>)}
    <dl className={styles.totals}>
      <div><dt>Subtotal de productos</dt><dd>{money(reservationItemsSubtotal(row))}</dd></div>
      <div><dt>{row.delivery_type === "DELIVERY" ? <><Truck size={16} aria-hidden="true" />Envío del comercio</> : <><Store size={16} aria-hidden="true" />Retiro en el comercio</>}</dt><dd>{row.delivery_price ? money(row.delivery_price) : "Gratis"}</dd></div>
      <div className={styles.totalLine}><dt>Total del pedido</dt><dd>{money(row.total)}</dd></div>
    </dl>
  </section>;
}

export function ReservationOrderTimeline({ display }: { display: OrderDisplay }) {
  const steps = [
    { status: "PENDING", label: "Reserva recibida", date: display.createdAt },
    { status: "CONFIRMED", label: "Confirmada", date: display.confirmedAt },
    { status: "READY", label: display.deliveryType === "pickup" ? "Lista para retirar" : "Lista para enviar", date: display.readyAt },
    { status: "COMPLETED", label: "Completada", date: display.completedAt },
  ];
  return <ol className={styles.timeline} aria-label="Progreso del pedido">
    {steps.map((step) => {
      const current = display.status === step.status;
      const completed = Boolean(step.date) && (!current || display.status === "COMPLETED");
      return <li key={step.status} className={`${completed ? styles.reached : ""} ${current ? styles.current : ""}`} aria-current={current ? "step" : undefined}>
        <span className={styles.stepIndicator} aria-hidden="true">{completed ? <Check size={15} /> : current ? <span className={styles.currentDot} /> : <Circle size={10} />}</span>
        <div><strong>{step.label}</strong><span className={styles.srOnly}>{current ? ", estado actual" : completed ? ", completada" : ", pendiente"}</span>{step.date && <time dateTime={step.date}>{reservationDate(step.date)}</time>}</div>
      </li>;
    })}
  </ol>;
}

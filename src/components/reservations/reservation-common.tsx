import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { money, photo } from "@/lib/products";
import type { DeliveryType, Reservation, ReservationStatus } from "@/types/reservations";
import { ProductImage } from "../details/product-image";

export const reservationLabels: Record<ReservationStatus, string> = {
  PENDING: "Esperando confirmación", CONFIRMED: "Reserva confirmada", READY: "Listo para retirar",
  COMPLETED: "Completada", CANCELLED: "Cancelada", EXPIRED: "Reserva vencida",
};
export const deliveryLabel = (type: DeliveryType) => type === "pickup" ? "Retirar en comercio" : "Envío del comercio";
export const reservationDate = (value: string) => new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });

export function ReservationStatusBadge({ reservation }: { reservation: Pick<Reservation, "status" | "deliveryType"> }) {
  return <span className={`reservation-status status-${reservation.status.toLowerCase()}`} role="status"><i />{reservation.status === "READY" && reservation.deliveryType === "delivery" ? "Listo para enviar" : reservationLabels[reservation.status]}</span>;
}

export function ReservationProduct({ name, image, business, productId }: { name: string; image: string; business: string; productId: string }) {
  const realImage = image.startsWith("/") || /^https?:\/\//i.test(image);
  return <div className="reservation-product">{realImage ? <ProductImage src={image} alt={name} /> : <Image src={photo(image, 320)} alt={name} width={100} height={100} />}<div><Link href={`/producto/${productId}`}>{name}</Link><p>{business}</p><small>{realImage ? "Producto del comercio" : "Foto ilustrativa"}</small></div></div>;
}

export function ReservationTotals({ quantity, unitPrice, deliveryPrice, deliveryType, total }: Pick<Reservation, "quantity" | "unitPrice" | "deliveryPrice" | "deliveryType" | "total">) {
  return <dl className="reservation-totals"><div><dt>Precio unitario</dt><dd>{money(unitPrice)}</dd></div><div><dt>Cantidad</dt><dd>{quantity}</dd></div><div><dt>Productos</dt><dd>{money(unitPrice * quantity)}</dd></div><div><dt>{deliveryType === "delivery" ? "Envío del comercio" : "Retiro en comercio"}</dt><dd>{deliveryPrice ? money(deliveryPrice) : "Sin costo"}</dd></div><div className="reservation-total"><dt>Total</dt><dd>{money(total)}</dd></div></dl>;
}

export function ReservationSummary({ reservation }: { reservation: Reservation }) {
  return <>{reservation.productSource === "supabase" && <p className="info-note">Reserva de prueba. No se envió al comercio ni se modificó su stock.</p>}<ReservationProduct name={reservation.productName} image={reservation.productImage} business={reservation.businessName} productId={reservation.productId} /><ReservationTotals {...reservation} /><dl className="request-facts"><div><dt>Número de reserva</dt><dd>{reservation.id}</dd></div><div><dt>Modalidad</dt><dd>{deliveryLabel(reservation.deliveryType)}</dd></div><div><dt>Creada</dt><dd><time dateTime={reservation.createdAt}>{reservationDate(reservation.createdAt)}</time></dd></div><div><dt>Comprador demo</dt><dd>{reservation.buyerName}<br />{reservation.buyerPhone}</dd></div></dl></>;
}

export function ReservationProgress({ reservation }: { reservation: Pick<Reservation, "status" | "deliveryType" | "createdAt" | "confirmedAt" | "readyAt" | "completedAt"> }) {
  const steps = [
    { status: "PENDING", label: "Reserva enviada", date: reservation.createdAt },
    { status: "CONFIRMED", label: "Confirmada", date: reservation.confirmedAt },
    { status: "READY", label: reservation.deliveryType === "pickup" ? "Listo para retirar" : "Listo para enviar", date: reservation.readyAt },
    { status: "COMPLETED", label: "Completada", date: reservation.completedAt },
  ];
  return <ol className="reservation-progress" aria-label="Progreso de la reserva">{steps.map((step, index) => <li key={step.status} className={`${step.date ? "reached" : ""} ${reservation.status === step.status ? "active" : ""}`} aria-current={reservation.status === step.status ? "step" : undefined}><span aria-hidden="true">{step.date && reservation.status !== step.status ? <Check size={18} /> : index + 1}</span><div><strong>{step.label}</strong>{step.date && <time dateTime={step.date}>{reservationDate(step.date)}</time>}</div></li>)}</ol>;
}

export function LoadingReservations() { return <p className="workflow-loading" role="status">Cargando reservas de este navegador…</p>; }
export function MissingReservation({ business = false }: { business?: boolean }) {
  return <section className="empty-state"><h1>No encontramos esta reserva</h1><p>Las reservas se guardan en el navegador donde las creaste. Puede que los datos locales se hayan eliminado.</p><Link className="primary-button" href={business ? "/comercio/reservas" : "/reservas"}>Ver reservas</Link></section>;
}

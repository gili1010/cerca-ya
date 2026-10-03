"use client";

import Link from "next/link";
import { useState } from "react";
import { money } from "@/lib/products";
import { placeholderImage } from "@/lib/public-catalog";
import { reservationStatuses } from "@/types/reservations";
import { FormError, RelativeDate } from "../requests/request-common";
import { useRequestClock } from "../requests/buyer-request-common";
import { LiveFeedback } from "../requests/use-live-changes";
import { MerchantBusinessGate } from "../merchant-products/business-gate";
import { useRealReservations } from "./use-real-reservations";
import { reservationDisplay } from "./real-reservation-common";
import { deliveryLabel, reservationLabels, ReservationProduct, ReservationStatusBadge } from "./reservation-common";

export function ReservationList({ business = false }: { business?: boolean }) {
  return business ? <MerchantBusinessGate>{() => <ReservationListContent business />}</MerchantBusinessGate> : <ReservationListContent business={false} />;
}
function ReservationListContent({ business }: { business: boolean }) {
  const data = useRealReservations(business);
  const now = useRequestClock();
  const [status, setStatus] = useState("all");
  const rows = data.data ?? [];
  const reservations = rows.filter(row => status === "all" || reservationDisplay(row, now).status === status);
  return <><div className="workflow-heading with-action"><div><span className="eyebrow">{business ? "Modo comercio" : "Tus productos cerca"}</span><h1>{business ? "Reservas recibidas" : "Mis reservas"}</h1><p>{business ? "Confirmá la disponibilidad, prepará el producto y registrá la entrega." : "Seguí la confirmación y preparación de tus productos."}</p></div><button className="outline-button" disabled={data.busy} onClick={() => void data.refresh()}>{data.busy ? "Actualizando..." : "Actualizar"}</button></div>
    <LiveFeedback state={data.live} notice={data.notice} /><FormError message={data.error} />
    <div className="reservation-filters"><label>Estado<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Todos los estados</option>{reservationStatuses.map(value => <option key={value} value={value}>{value === "READY" ? "Lista para retirar / enviar" : reservationLabels[value]}</option>)}</select></label></div>
    {data.loading && <p className="workflow-loading" role="status">Cargando reservas...</p>}
    {data.data && <><p className="opportunity-count">{reservations.length} reservas{business ? ` · ${rows.filter(row => reservationDisplay(row, now).status === "PENDING").length} pendientes` : ""}</p>
    <div className="request-list-grid">{reservations.map(row => { const display = reservationDisplay(row, now); return <article className="panel reservation-card" key={row.id}><div className="card-topline"><span className="buyer-request-id">{row.id}</span><ReservationStatusBadge reservation={display} /></div>
      <ReservationProduct name={row.product_name} image={row.product_image ?? placeholderImage} business={row.business_name} productId={row.product_id} />
      <div className="reservation-card-meta"><span>Cantidad: {row.quantity}</span><strong>{money(row.total)}</strong><span>{deliveryLabel(display.deliveryType)}</span></div><RelativeDate date={row.created_at} /><div className="request-card-bottom"><Link className="secondary-link" href={`${business ? "/comercio" : ""}/reserva/${row.id}`}>Ver reserva →</Link></div></article>; })}</div>
      {!reservations.length && <section className="empty-state"><h2>{status !== "all" ? "No hay reservas con este filtro" : business ? "Todavía no recibiste reservas" : "Todavía no tenés reservas"}</h2><Link className="primary-button" href="/">Explorar productos</Link></section>}</>}
  </>;
}


"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { reservationError, type ReservationAction } from "@/lib/real-reservations";
import { Dialog } from "../home/dialog";
import { FormError } from "../requests/request-common";
import { useRequestClock } from "../requests/buyer-request-common";
import { LiveFeedback } from "../requests/use-live-changes";
import { useRealReservations } from "./use-real-reservations";
import { RealReservationSummary, reservationDisplay, UnavailableReservation } from "./real-reservation-common";
import { reservationDate, ReservationProgress, ReservationStatusBadge } from "./reservation-common";

export function ReservationDetail({ id, business = false, confirmation = false }: { id: string; business?: boolean; confirmation?: boolean }) {
  const data = useRealReservations(business, id);
  const now = useRequestClock();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const running = useRef(false);
  const row = data.data?.[0];
  const display = row ? reservationDisplay(row, now) : null;
  const cancellable = display?.status === "PENDING" || display?.status === "CONFIRMED";
  async function act(action: ReservationAction) {
    if (!row || running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { error: failure } = await client.rpc("manage_my_reservation", { p_reservation_id: row.id, p_action: action });
      if (failure) { setError(reservationError(failure)); await data.refresh(); return; }
      setCancelDialog(false); await data.refresh();
    } catch { setError("No pudimos actualizar la reserva."); }
    finally { running.current = false; setBusy(false); }
  }
  if (data.loading) return <p className="workflow-loading" role="status">Cargando reservas...</p>;
  if (!row || !display) return data.error ? <section className="panel"><FormError message={data.error} /><button className="outline-button" onClick={() => void data.refresh()}>Reintentar</button></section> : <UnavailableReservation business={business} />;
  return <div className="workflow-narrow"><Link className="secondary-link" href={business ? "/comercio/reservas" : "/reservas"}>{business ? "Reservas recibidas" : "Mis reservas"}</Link>
    <LiveFeedback state={data.live} notice={data.notice} /><FormError message={data.error} /><section className="panel reservation-detail" data-reservation-status={display.status}>
      <div className="card-topline"><span className="buyer-request-id">{row.id}</span><ReservationStatusBadge reservation={display} /></div><h1>{confirmation ? "Reserva enviada" : business ? "Gestionar reserva" : "Detalle de reserva"}</h1>
      <button className="secondary-link" disabled={data.busy || busy} onClick={() => void data.refresh()}>{data.busy ? "Actualizando..." : "Actualizar"}</button>
      <RealReservationSummary row={row} now={now} /><ReservationProgress reservation={display} />
      {display.status === "PENDING" && <p className="reservation-notice">{business ? "El stock se descuenta al confirmar esta reserva." : "El comercio debe confirmar que el producto sigue disponible."}<br />Vence sin confirmación el <time dateTime={row.expires_at}>{reservationDate(row.expires_at)}</time>.</p>}
      {display.status === "CONFIRMED" && <p className="reservation-notice">Reserva confirmada. El comercio está preparando tu producto.</p>}
      {display.status === "READY" && <p className="reservation-notice">{display.deliveryType === "pickup" ? "Tu pedido está listo para retirar." : "Tu pedido está listo para enviar."}</p>}
      {display.status === "COMPLETED" && <p className="reservation-notice">Reserva completada.</p>}
      {display.status === "EXPIRED" && <p className="info-note">La reserva venció sin confirmación. No se descontó stock.</p>}
      {display.status === "CANCELLED" && <p className="info-note">Reserva cancelada. {row.confirmed_at ? "Las unidades se devolvieron al stock." : "No se descontó stock."}</p>}
      {business && <p className="info-note">Stock disponible al actualizar: {row.current_stock} unidades.</p>}
      {!cancelDialog && <FormError message={error} />}
      <div className="reservation-actions" aria-busy={busy}>
        {business && display.status === "PENDING" && <><button className="primary-button" disabled={busy} onClick={() => void act("confirm")}>Confirmar reserva</button><button className="danger-button" disabled={busy} onClick={() => void act("cancel")}>Rechazar</button></>}
        {business && display.status === "CONFIRMED" && <button className="primary-button" disabled={busy} onClick={() => void act("ready")}>Marcar como lista</button>}
        {business && display.status === "READY" && <button className="primary-button" disabled={busy} onClick={() => void act("complete")}>Marcar como entregada</button>}
        {cancellable && (!business || display.status === "CONFIRMED") && <button className="danger-button" disabled={busy} onClick={() => { setError(""); setCancelDialog(true); }}>Cancelar reserva</button>}
      </div>
      {confirmation && <Link className="secondary-link" href={`/reserva/${id}`}>Ver mi reserva</Link>}
    </section>
    {cancelDialog && <Dialog title="Cancelar reserva" onClose={() => { if (!busy) setCancelDialog(false); }}><div className="dialog-body text-dialog"><h2>¿Cancelar esta reserva?</h2><p>{display.status === "CONFIRMED" ? "Las unidades reservadas volverán al stock." : "La reserva dejará de esperar confirmación."}</p><FormError message={error} /><div className="dialog-actions"><button className="danger-button" disabled={busy || !cancellable} onClick={() => void act("cancel")}>{busy ? "Cancelando..." : "Cancelar reserva"}</button><button className="ghost-button" disabled={busy} onClick={() => setCancelDialog(false)}>Volver</button></div>{!cancellable && <p className="info-note">Esta reserva ya cambió de estado.</p>}</div></Dialog>}
  </div>;
}

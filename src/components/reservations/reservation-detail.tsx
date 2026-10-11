"use client";
import { BackLink, BackButton } from "@/components/navigation/back-link";

import Link from "next/link";
import { useRef, useState } from "react";
import { Clock3, ListChecks, Store, Truck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { reservationError, reservationItems, type ReservationAction } from "@/lib/real-reservations";
import { Dialog } from "../home/dialog";
import { FormError } from "../requests/request-common";
import { useRequestClock } from "../requests/buyer-request-common";
import { LiveFeedback } from "../requests/use-live-changes";
import { useRealReservations } from "./use-real-reservations";
import { reservationDisplay, UnavailableReservation } from "./real-reservation-common";
import { reservationDate } from "./reservation-common";
import { ReservationCheckoutDetail } from "./reservation-checkout-detail";
import { OrderStatusBadge, ReservationOrderSummary, ReservationOrderTimeline } from "./reservation-order-summary";
import { money } from "@/lib/products";
import styles from "./reservation-detail.module.css";

export function ReservationDetail({ id, business = false, confirmation = false }: { id: string; business?: boolean; confirmation?: boolean }) {
  const data = useRealReservations(business, id);
  const now = useRequestClock();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const running = useRef(false);
  const row = data.data?.[0];
  const items = row ? reservationItems(row) : [];
  const onDemand = items.length > 0 && items.every(item => item.inventory_mode_snapshot === "ON_DEMAND");
  const stockedItems = items.filter(item => item.inventory_mode_snapshot === "STOCKED");
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
    } catch { setError("No pudimos actualizar el pedido."); }
    finally { running.current = false; setBusy(false); }
  }
  if (data.loading) return <p className="workflow-loading" role="status">Cargando pedido...</p>;
  if (!row || !display) return data.error ? <section className="panel"><FormError message={data.error} /><button className="outline-button" onClick={() => void data.refresh()}>Reintentar</button></section> : <UnavailableReservation business={business} />;
  return <div className={styles.root}>
    <div className={styles.toolbar}>
      <BackLink href={business ? "/comercio/reservas" : "/reservas"}>{business ? "Pedidos recibidos" : "Mis pedidos"}</BackLink>
      <button className="secondary-link" disabled={data.busy || busy} onClick={() => void data.refresh()}>{data.busy ? "Actualizando..." : "Actualizar"}</button>
    </div>
    <LiveFeedback state={data.live} notice={data.notice} /><FormError message={data.error} />
    <header className={styles.header}>
      <p className={styles.eyebrow}>{confirmation ? "Pedido enviado" : business ? "Pedido recibido" : "Tu pedido"}</p>
      <div className={styles.headingRow}>
        <h1>Pedido #{row.id.replaceAll("-", "").slice(0, 6).toUpperCase()}</h1>
        <OrderStatusBadge display={display} />
      </div>
      <span className={styles.date}><Clock3 size={14} aria-hidden="true" /><time dateTime={row.created_at}>{reservationDate(row.created_at)}</time></span>
    </header>
    <section className={styles.overview} aria-label="Resumen del pedido">
      <div className={styles.overviewInfo}>
        <strong>{items[0].product_name_snapshot}{items.length > 1 ? ` + ${items.length - 1} ${items.length === 2 ? "producto más" : "productos más"}` : ""}</strong>
        <p><Store size={16} aria-hidden="true" />{row.business_name}</p>
        <span className={styles.modality}>{display.deliveryType === "pickup" ? <><Store size={15} aria-hidden="true" />Retiro en el comercio</> : <><Truck size={15} aria-hidden="true" />Envío del comercio</>}</span>
      </div>
      <div className={styles.overviewTotal}><span>Total del pedido</span><strong>{money(row.total)}</strong></div>
    </section>
    <div className={styles.layout}>
      <section className={styles.action} data-status={display.status} aria-labelledby="order-action-title">
        <h2 id="order-action-title" className={styles.sectionTitle}>{business && ["PENDING", "CONFIRMED", "READY"].includes(display.status) ? "Próximo paso" : "Estado del pedido"}</h2>
        {display.status === "PENDING" && <p className={styles.actionText}>{business ? onDemand ? "Confirmá que podés preparar este pedido para comenzar." : "Confirmá la disponibilidad para comenzar a preparar el pedido." : onDemand ? "El comercio debe confirmar la preparación de tu pedido." : "El comercio debe confirmar la disponibilidad de tu pedido."}<span className={styles.expiry}>Vence sin confirmación el <time dateTime={row.expires_at}>{reservationDate(row.expires_at)}</time>.</span></p>}
        {display.status === "CONFIRMED" && <p className={styles.actionText}>{business ? display.deliveryType === "pickup" ? "Prepará el pedido y avisá cuando esté listo para retirar." : "Prepará el pedido y avisá cuando esté listo para enviar." : "Pedido confirmado. El comercio está preparando tu pedido."}</p>}
        {display.status === "READY" && <p className={styles.actionText}>{business ? "Cuando el cliente reciba el pedido, marcalo como entregado." : display.deliveryType === "pickup" ? "Tu pedido está listo para retirar." : "Tu pedido está listo para enviar."}</p>}
        {display.status === "COMPLETED" && <p className={styles.actionText}>Pedido completado. La entrega fue registrada.</p>}
        {display.status === "EXPIRED" && <p className={styles.actionText}>El pedido venció sin confirmación.{!onDemand && " No se descontó stock."}</p>}
        {display.status === "CANCELLED" && <p className={styles.actionText}>Pedido cancelado. {onDemand ? "Se canceló la preparación a pedido." : row.confirmed_at ? "Las unidades descontadas de los productos con stock se devolvieron al stock." : "No se descontó stock."}</p>}
        {!cancelDialog && <FormError message={error} />}
        <div className={styles.actions} aria-busy={busy}>
          {business && display.status === "PENDING" && <><button className="primary-button" disabled={busy} onClick={() => void act("confirm")}>Confirmar pedido</button><button className={`danger-button ${styles.secondaryDanger}`} disabled={busy} onClick={() => void act("cancel")}>Rechazar pedido</button></>}
          {business && display.status === "CONFIRMED" && <button className="primary-button" disabled={busy} onClick={() => void act("ready")}>{display.deliveryType === "pickup" ? "Marcar como listo para retirar" : "Marcar como listo para enviar"}</button>}
          {business && display.status === "READY" && <button className="primary-button" disabled={busy} onClick={() => void act("complete")}>Marcar como entregado</button>}
          {cancellable && (!business || display.status === "CONFIRMED") && <button className={`danger-button ${styles.secondaryDanger}`} disabled={busy} onClick={() => { setError(""); setCancelDialog(true); }}>Cancelar pedido</button>}
        </div>
        {confirmation && <Link className={`secondary-link ${styles.confirmationLink}`} href={`/reserva/${id}`}>Ver mi pedido</Link>}
      </section>
      <div className={styles.main}>
        <ReservationOrderSummary row={row} />
        <ReservationCheckoutDetail row={row} business={business} status={display.status} />
      </div>
      <section className={styles.history} aria-labelledby="order-history-title">
        <h2 id="order-history-title" className={styles.sectionTitle}><ListChecks size={19} aria-hidden="true" />Estado del pedido</h2>
        <ReservationOrderTimeline display={display} />
        {business && stockedItems.map(item => <p className={styles.stockNote} key={item.id}>{item.product_name_snapshot} · Stock disponible al actualizar: {item.current_stock} unidades.</p>)}
        <details className={styles.identifier}><summary>Ver identificador completo</summary><p>{row.id}</p></details>
      </section>
    </div>
    {cancelDialog && <Dialog title="Cancelar pedido" onClose={() => { if (!busy) setCancelDialog(false); }}><div className="dialog-body text-dialog"><h2>¿Cancelar este pedido?</h2><p>{onDemand ? "Se cancelará la preparación de este pedido." : display.status === "CONFIRMED" ? "Las unidades descontadas de los productos con stock volverán al stock." : "El pedido dejará de esperar confirmación."}</p><FormError message={error} /><div className="dialog-actions"><button className="danger-button" disabled={busy || !cancellable} onClick={() => void act("cancel")}>{busy ? "Cancelando..." : "Cancelar pedido"}</button><BackButton  disabled={busy} onClick={() => setCancelDialog(false)}>Volver</BackButton></div>{!cancellable && <p className="info-note">Este pedido ya cambió de estado.</p>}</div></Dialog>}
  </div>;
}

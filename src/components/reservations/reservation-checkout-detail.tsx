"use client";

import { useState } from "react";
import { Copy, MessageCircle } from "lucide-react";
import type { ReservationView } from "@/types/database";
import type { ReservationStatus } from "@/types/reservations";
import { money } from "@/lib/products";
import { paymentLabels } from "@/lib/reservation-checkout";
import { argentinaWhatsAppUrl, formatArgentinaPhone } from "@/lib/phone";
import styles from "./reservation-checkout.module.css";

export function ReservationCheckoutDetail({ row, business, status }: { row: ReservationView; business: boolean; status: ReservationStatus }) {
  const [copyNotice, setCopyNotice] = useState("");
  const released = row.confirmed_at !== null && ["CONFIRMED", "READY", "COMPLETED"].includes(row.status);
  const contact = business && released && row.customer_phone
    ? argentinaWhatsAppUrl(row.customer_phone, `Hola ${row.customer_name ?? ""}, te contactamos de ${row.business_name} por tu reserva de ${row.product_name} en CercaYa.`) : null;
  async function copyAlias() {
    if (!row.transfer_alias) return;
    try { await navigator.clipboard.writeText(row.transfer_alias); setCopyNotice("Alias copiado"); }
    catch { setCopyNotice("No pudimos copiarlo. Seleccioná el alias y copialo manualmente."); }
  }
  return <div className={styles.details}>
    {!row.customer_name && <p className="info-note">Esta reserva se creó antes de incorporar los datos de contacto y entrega. No tiene esos datos guardados.</p>}
    {row.customer_name && <section className={styles.detailSection} aria-label="Cliente">
      <h2>{business ? "Cliente" : "Tus datos de contacto"}</h2>
      <dl><div><dt>Nombre</dt><dd>{row.customer_name}</dd></div>
        {row.customer_phone && <div><dt>Teléfono</dt><dd>{formatArgentinaPhone(row.customer_phone)}</dd></div>}
      </dl>
      {business && !released && <p className={styles.help}>{status === "PENDING" ? "El teléfono, la dirección exacta, las referencias y notas se habilitan al confirmar la reserva." : "Los datos privados de contacto y entrega no están disponibles en este estado."}</p>}
      {contact && <a className="outline-button" href={contact} target="_blank" rel="noopener noreferrer"><MessageCircle size={17} aria-hidden="true" />Contactar por WhatsApp</a>}
    </section>}
    <section className={styles.detailSection} aria-label={row.delivery_type === "DELIVERY" ? "Entrega" : "Retiro"}>
      <h2>{row.delivery_type === "DELIVERY" ? "Entrega" : "Retiro en el comercio"}</h2>
      <dl>
        {row.delivery_type === "DELIVERY" ? <>
          {row.delivery_address && <div><dt>Dirección de entrega</dt><dd>{row.delivery_address}</dd></div>}
          <div><dt>Localidad</dt><dd>{row.delivery_city || "Sin informar"}</dd></div>
          {row.delivery_reference && <div><dt>Referencia</dt><dd>{row.delivery_reference}</dd></div>}
        </> : <>
          <div><dt>Comercio</dt><dd>{row.business_name}</dd></div>
          <div><dt>Dirección</dt><dd>{row.pickup_address || "Consultá la dirección al comercio"}</dd></div>
          <div><dt>Localidad</dt><dd>{row.pickup_city || "Sin informar"}</dd></div>
        </>}
      </dl>
    </section>
    <section className={styles.detailSection} aria-label="Pago">
      <h2>Pago</h2>
      <dl><div><dt>Forma de pago</dt><dd>{row.payment_method ? paymentLabels[row.payment_method] : "No informada en esta reserva"}</dd></div></dl>
      {!business && row.payment_method === "TRANSFER" && released && <>
        <dl><div><dt>Total a transferir</dt><dd>{money(row.total)}</dd></div></dl>
        {row.transfer_alias ? <><dl><div><dt>Alias</dt><dd className={styles.alias}>{row.transfer_alias}</dd></div></dl><button className="outline-button" type="button" onClick={() => void copyAlias()}><Copy size={16} aria-hidden="true" />Copiar alias</button><p className={styles.copyNotice} role="status">{copyNotice}</p></> : <p className={styles.help}>El comercio no indicó un alias al crear esta reserva. Coordiná los datos para transferir directamente con él.</p>}
      </>}
      {!business && row.payment_method === "TRANSFER" && status === "PENDING" && <p className={styles.help}>Esperá la confirmación del comercio. Después podrás consultar el alias, si fue informado.</p>}
      <p className={styles.help}>{row.payment_method === "CASH" ? "El pago en efectivo se realiza directamente al comercio." : row.payment_method === "ARRANGE" ? "Coordiná la forma de pago directamente con el comercio." : "CercaYa no procesa ni verifica transferencias."}</p>
    </section>
    {row.customer_notes && <section className={styles.detailSection} aria-label="Notas del comprador"><h2>Notas del comprador</h2><p className={styles.notes}>{row.customer_notes}</p></section>}
  </div>;
}

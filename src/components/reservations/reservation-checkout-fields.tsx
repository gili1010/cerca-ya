"use client";

import type { ReservationCheckoutInput } from "@/lib/reservation-checkout";
import { paymentLabels } from "@/lib/reservation-checkout";
import type { PaymentMethod } from "@/types/database";
import styles from "./reservation-checkout.module.css";

interface CheckoutFieldsProps {
  value: ReservationCheckoutInput; onChange: (value: ReservationCheckoutInput) => void;
  delivery: boolean; disabled: boolean; acceptsCash: boolean; acceptsTransfer: boolean;
}

export function ReservationCheckoutFields({ value, onChange, delivery, disabled, acceptsCash, acceptsTransfer }: CheckoutFieldsProps) {
  const methods: PaymentMethod[] = [...(acceptsCash ? ["CASH" as const] : []), ...(acceptsTransfer ? ["TRANSFER" as const] : []), "ARRANGE"];
  return <div className={styles.fields}>
    {delivery && <fieldset className={styles.section} disabled={disabled}>
      <legend>Entrega</legend>
      <div className={styles.columns}>
        <label>Dirección<input value={value.delivery_address} onChange={event => onChange({ ...value, delivery_address: event.target.value })} required maxLength={240} autoComplete="shipping street-address" placeholder="Calle y número, piso o departamento" /></label>
        <label>Localidad<input value={value.delivery_city} onChange={event => onChange({ ...value, delivery_city: event.target.value })} required maxLength={120} autoComplete="shipping address-level2" placeholder="Por ejemplo, Alta Gracia" /></label>
      </div>
      <p className={styles.help}>El comercio verá tu dirección exacta y teléfono sólo después de confirmar el pedido.</p>
    </fieldset>}
    <fieldset className={styles.section} disabled={disabled}>
      <legend>Contacto</legend>
      <div className={styles.columns}>
        <label>{delivery ? "Nombre y apellido" : "Nombre"}<input value={value.customer_name} onChange={event => onChange({ ...value, customer_name: event.target.value })} required maxLength={160} autoComplete="shipping name" /></label>
        <label>Teléfono · Argentina (+54)<input type="tel" value={value.customer_phone} onChange={event => onChange({ ...value, customer_phone: event.target.value })} required maxLength={40} autoComplete="shipping tel" placeholder="3547636574" /></label>
      </div>
      <p className={styles.help}>Estos datos se usan para este pedido. No cambian tu perfil. Ingresá el teléfono con código de área, sin 0 ni 15.</p>
    </fieldset>
    <fieldset className={styles.section} disabled={disabled}>
      <legend>Pago</legend>
      <div className={styles.paymentMethods}>{methods.map(method => <label key={method} className={value.payment_method === method ? styles.selected : ""}>
        <input type="radio" name="reservation-payment" checked={value.payment_method === method} onChange={() => onChange({ ...value, payment_method: method })} />{paymentLabels[method]}
      </label>)}</div>
      <p className={styles.help}>El pago se acuerda con el comercio. CercaYa no cobra ni procesa dinero.{value.payment_method === "TRANSFER" && " Si indicó un alias, lo verás cuando confirme el pedido."}</p>
    </fieldset>
    <details className={styles.optional}>
      <summary>Agregar {delivery ? "referencias o " : ""}notas <span>Opcional</span></summary>
      <fieldset className={styles.section} disabled={disabled}>
        {delivery && <label>Referencia de entrega<input value={value.delivery_reference} onChange={event => onChange({ ...value, delivery_reference: event.target.value })} maxLength={500} placeholder="Por ejemplo, portón negro" /></label>}
        <label>Notas para el comercio<textarea value={value.customer_notes} onChange={event => onChange({ ...value, customer_notes: event.target.value })} maxLength={1000} rows={2} placeholder="Indicaciones o algo que el comercio deba saber" /></label>
      </fieldset>
    </details>
  </div>;
}

"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Dialog } from "../home/dialog";
import { adminDate } from "./admin-common";
import { setBusinessVerification } from "@/lib/admin/verification-actions";
import { verificationRemovalReasons, type BusinessVerification } from "@/lib/admin/verification-types";
import styles from "./admin.module.css";
export function AdminBusinessVerification({ id, name, verification }: { id: string; name: string; verification: BusinessVerification }) {
  const [open, setOpen] = useState(false), [reason,setReason] = useState(""), [note,setNote] = useState(""), [error,setError] = useState(""), [notice,setNotice] = useState("");
  const [pending,startTransition] = useTransition(); const router = useRouter();
  const verified = verification.verified;
  return <section className={`${styles.panel} ${styles.detail}`} aria-labelledby="business-verification-heading">
    <h2 id="business-verification-heading">Verificación</h2><p><span className={`${styles.badge} ${verified ? styles.active : styles.inactive}`}>{verified && <Check size={13} aria-hidden="true" />}{verified ? "Verificado" : "No verificado"}</span></p>
    {verified && <dl className={styles.facts}><div><dt>Verificado el</dt><dd>{verification.verified_at ? adminDate(verification.verified_at) : "Verificación anterior sin fecha registrada"}</dd></div><div><dt>Verificado por</dt><dd>{verification.admin_name || (verification.verified_by ? "Administrador" : "Sin administrador registrado")}{verification.verified_by && <small className={styles.identifier}>{verification.verified_by}</small>}</dd></div></dl>}
    <p className={styles.muted}>{verified ? "CercaYa confirmó la existencia de este comercio y su responsable." : "La verificación confirma la existencia del comercio y su responsable."}</p>
    <button className={styles.button} onClick={() => { setError("");setNotice("");setReason("");setNote("");setOpen(true); }}>{verified ? "Quitar verificación" : "Verificar comercio"}</button>
    {notice && <p className={styles.notice} role="status">{notice}</p>}
    {open && <Dialog title={verified ? "Quitar verificación" : "Verificar comercio"} className={styles.dialog} onClose={() => { if (!pending) setOpen(false); }}>
      <h2>{verified ? "Quitar verificación" : "Verificar comercio"}</h2><p className={styles.resourceName}>{name}</p>
      <p>{verified ? "El comercio seguirá existiendo y conservará su estado actual. Sólo se retirará la verificación." : "¿Confirmás que verificaste que este comercio existe y que la cuenta está vinculada a una persona responsable del mismo?"}</p>
      <form onSubmit={event => { event.preventDefault(); setError(""); startTransition(async () => { try { const result = await setBusinessVerification({ id, verified: !verified, reason, note }); if (result.error) { setError(result.error);return; } setOpen(false);setNotice(verified ? "Verificación retirada." : "Comercio verificado.");router.refresh(); } catch { setError("No pudimos completar la operación. Volvé a intentar."); } }); }}>
        {verified && <label>Motivo<select value={reason} required disabled={pending} onChange={event => setReason(event.target.value)}><option value="">Seleccioná un motivo</option>{verificationRemovalReasons.map(value => <option key={value}>{value}</option>)}</select></label>}
        <label>Nota administrativa <span>(opcional)</span><textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} disabled={pending} /></label>
        {error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.dialogActions}><button className={styles.button} type="button" disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button className={styles.primaryButton} disabled={pending}>{pending ? "Guardando…" : verified ? "Quitar verificación" : "Confirmar verificación"}</button></div>
      </form>
    </Dialog>}
  </section>;
}

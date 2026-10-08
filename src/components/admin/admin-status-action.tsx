"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/home/dialog";
import { setAdminResourceStatus } from "@/lib/admin/actions";
import { setUserSuspension } from "@/lib/admin/phase2-actions";
import { userSuspensionReasons } from "@/lib/admin/phase2-types";
import { adminReasons, type AdminEntity } from "@/lib/admin/types";
import styles from "./admin.module.css";

export function AdminStatusAction({ entity, id, name, blocked }: { entity: AdminEntity | "user"; id: string; name: string; blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const resource = entity === "user" ? "usuario" : entity === "business" ? "comercio" : "producto";
  const label = blocked ? `Reactivar ${resource}` : entity === "product" ? "Desactivar producto" : `Suspender ${resource}`;
  const reasons = entity === "user" ? userSuspensionReasons : adminReasons;
  return <div className={styles.actionCell}>
    <button className={blocked ? styles.button : styles.dangerButton} onClick={() => { setError(""); setNotice(""); setReason(""); setNote(""); setOpen(true); }}>{label}</button>
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {open && <Dialog title={label} className={styles.dialog} onClose={() => { if (!pending) setOpen(false); }}>
      <h2>{blocked ? `¿Reactivar este ${resource}?` : entity === "product" ? "¿Desactivar este producto?" : `¿Suspender este ${resource}?`}</h2>
      <p className={styles.resourceName}>{name}</p>
      <p>{entity === "user" ? blocked ? "La cuenta podrá volver a realizar acciones de marketplace." : "La cuenta podrá iniciar sesión y consultar su historial, pero no podrá realizar acciones de marketplace. Sus datos y pedidos se conservarán." : blocked ? "Se retirará el bloqueo y se restaurará su estado anterior. Si ya estaba inactivo, seguirá inactivo." : entity === "business" ? "El comercio y sus productos dejarán de aparecer públicamente. Los pedidos históricos se conservarán." : "El producto dejará de aparecer públicamente. El comerciante no podrá reactivarlo mientras siga bloqueado."}</p>
      <form onSubmit={event => {
        event.preventDefault();
        setError("");
        startTransition(async () => {
          try {
            const result = entity === "user" ? await setUserSuspension({ id, suspended: !blocked, reason: blocked ? "" : reason, note }) : await setAdminResourceStatus({ entity, id, blocked: !blocked, reason: blocked ? "" : reason, note });
            if (result.error) { setError(result.error); return; }
            setOpen(false); setNotice("Estado actualizado."); router.refresh();
          } catch { setError("No pudimos completar la operación. Revisá tu sesión y volvé a intentar."); }
        });
      }}>
        {!blocked && <label>Motivo<select required value={reason} onChange={event => setReason(event.target.value)} disabled={pending}><option value="">Seleccioná un motivo</option>{reasons.map(value => <option key={value}>{value}</option>)}</select></label>}
        <label>Nota interna <span>(opcional)</span><textarea maxLength={500} rows={3} value={note} onChange={event => setNote(event.target.value)} disabled={pending} /></label>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.dialogActions}><button type="button" className={styles.button} disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className={blocked ? styles.primaryButton : styles.dangerButton} disabled={pending}>{pending ? "Guardando…" : label}</button></div>
      </form>
    </Dialog>}
  </div>;
}

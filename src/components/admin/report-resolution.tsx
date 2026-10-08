"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/home/dialog";
import { resolveAdminReport } from "@/lib/admin/phase2-actions";
import styles from "./admin.module.css";
export function ReportResolution({ id }: { id: string }) {
  const [status, setStatus] = useState<"RESOLVED" | "DISMISSED" | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <><div className={styles.dialogActions}><button className={styles.primaryButton} onClick={() => { setNote(""); setError(""); setStatus("RESOLVED"); }}>Resolver</button><button className={styles.button} onClick={() => { setNote(""); setError(""); setStatus("DISMISSED"); }}>Descartar</button></div>{status && <Dialog title={status === "RESOLVED" ? "Resolver reporte" : "Descartar reporte"} className={styles.dialog} onClose={() => { if (!pending) setStatus(null); }}><h2>{status === "RESOLVED" ? "¿Resolver este reporte?" : "¿Descartar este reporte?"}</h2><p>Esta acción no bloquea ni suspende el recurso denunciado.</p><form onSubmit={event => { event.preventDefault(); startTransition(async () => {
    try { const result = await resolveAdminReport({ id, status, note }); if (result.error) { setError(result.error); return; } setStatus(null); router.refresh(); }
    catch { setError("No pudimos atender el reporte. Revisá tu sesión y volvé a intentar."); }
  }); }}><label>Nota administrativa (opcional)<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={3} disabled={pending} /></label>{error && <p className={styles.error} role="alert">{error}</p>}<div className={styles.dialogActions}><button className={styles.button} type="button" onClick={() => setStatus(null)} disabled={pending}>Cancelar</button><button className={styles.primaryButton} type="submit" disabled={pending}>{pending ? "Guardando…" : status === "RESOLVED" ? "Resolver reporte" : "Descartar reporte"}</button></div></form></Dialog>}</>;
}

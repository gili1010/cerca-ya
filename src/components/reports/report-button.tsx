"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { Flag } from "lucide-react";
import { Dialog } from "@/components/home/dialog";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loginUrl } from "@/lib/auth/redirect";
import { reportReasons } from "@/lib/admin/phase2-types";
import styles from "./report.module.css";

export function ReportButton({ entity, id, name }: { entity: "business" | "product"; id: string; name: string }) {
  const { user, loading } = useAuth();
  const path = usePathname();
  const [open, setOpen] = useState(false), [reason, setReason] = useState(""), [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [sent, setSent] = useState(false);
  const submitting = useRef(false);
  return <><button type="button" className={styles.trigger} disabled={loading} onClick={() => { setOpen(true); setError(""); setReason(""); setDetails(""); setSent(false); }}><Flag size={14} aria-hidden="true" />Reportar</button>{open && <Dialog title="Reportar" className={styles.modal} onClose={() => { if (!busy) setOpen(false); }}><header className={styles.header}><h2>Reportar {entity === "business" ? "comercio" : "producto"}</h2><p className={styles.resourceName}>{name}</p></header>{!user ? <div className={styles.message}><p>Iniciá sesión para enviar un reporte.</p><Link className="primary-button" href={loginUrl(path)}>Iniciar sesión</Link></div> : sent ? <div className={styles.message}><p role="status">Recibimos tu reporte. Lo revisaremos.</p><button className="outline-button" onClick={() => setOpen(false)}>Cerrar</button></div> : <form onSubmit={async event => {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("unavailable");
      const { error: failure } = await client.rpc("create_my_report", { p_entity: entity, p_entity_id: id, p_reason: reason, p_details: details.trim() });
      if (failure) {
        const message = failure.message;
        setError(message.includes("account_suspended") ? "Tu cuenta está suspendida." : message.includes("report_already_open") || failure.code === "23505" ? "Ya tenés un reporte pendiente sobre este recurso." : message.includes("report_rate_limit") ? "Alcanzaste el límite de reportes por hoy. Volvé a intentar más adelante." : message.includes("report_resource_unavailable") ? "Este recurso ya no está disponible." : "No pudimos enviar el reporte. Revisá tu sesión y volvé a intentar.");
      } else setSent(true);
    } catch { setError("No pudimos enviar el reporte. Revisá tu conexión y volvé a intentar."); }
    finally { setBusy(false); submitting.current = false; }
  }}><div className={styles.body}><label>Motivo<select required value={reason} disabled={busy} onChange={event => setReason(event.target.value)}><option value="">Seleccioná un motivo</option>{reportReasons.map(value => <option key={value}>{value}</option>)}</select></label><label><span className={styles.fieldLabel}>Contanos un poco más <small>(opcional)</small></span><textarea rows={4} maxLength={1000} value={details} onChange={event => setDetails(event.target.value)} disabled={busy} /></label>{error && <p role="alert" className={styles.error}>{error}</p>}</div><div className={styles.actions}><button className="outline-button" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button" type="submit" disabled={busy}>{busy ? "Enviando…" : "Enviar reporte"}</button></div></form>}</Dialog>}</>;
}


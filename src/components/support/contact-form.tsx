"use client";
import { BackLink } from "@/components/navigation/back-link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "../auth/auth-provider";
import { FormError } from "../requests/request-common";
import { contactReasons, validateContact } from "@/lib/support/contact";
import styles from "./support.module.css";
export function ContactForm() {
  const { user, profile } = useAuth();
  const [preferred, setPreferred] = useState("EMAIL");
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  const flight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const touched = useRef(new Set<string>());
  useEffect(() => {
    const form = formRef.current; if (!form) return;
    for (const [name, value] of Object.entries({ name: profile?.full_name || user?.user_metadata?.full_name || "", email: user?.email || "", phone: profile?.phone || "" })) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement && !touched.current.has(name) && value) field.value = String(value);
    }
  }, [profile, user]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (flight.current) return;
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    if (!validateContact(raw)) { setError("Revisá los datos y completá una forma válida de contacto según el método elegido."); return; }
    flight.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/contacto", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(raw) });
      if (!response.ok) { setError(response.status === 429 ? "Ya recibimos varias consultas con esos datos. Esperá un rato antes de enviar otra." : "No pudimos guardar tu consulta. Volvé a intentar más tarde."); return; }
      setDone(true);
    } catch { setError("No pudimos enviar tu consulta. Revisá tu conexión y volvé a intentar."); }
    finally { flight.current = false; setBusy(false); }
  }
  if (done) return <section className="panel workflow-narrow confirmation"><h1>Recibimos tu consulta</h1><p>Vamos a revisar tu mensaje y contactarte usando los datos que nos dejaste.</p><BackLink href="/">Volver a CercaYa</BackLink></section>;
  return <div className="workflow-narrow auth-page"><div className="workflow-heading"><h1>Contactá con CercaYa</h1><p>Contanos qué necesitás y te vamos a contactar.</p></div><form ref={formRef} className="workflow-form panel" onSubmit={submit} onInput={event => { const field = event.target; if (field instanceof HTMLInputElement) touched.current.add(field.name); }}>
    <label>Nombre<input name="name" autoComplete="name" required maxLength={120} /></label>
    <label>Método preferido<select name="preferred_contact" value={preferred} onChange={event => setPreferred(event.target.value)}><option value="PHONE">WhatsApp / teléfono</option><option value="EMAIL">Email</option></select></label>
    <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required={preferred === "PHONE"} maxLength={40} /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required={preferred === "EMAIL"} maxLength={254} /></label>
    <label>Motivo<select name="reason" required defaultValue=""><option value="" disabled>Seleccioná un motivo</option>{contactReasons.map(reason => <option key={reason}>{reason}</option>)}</select></label>
    <label>N.º de pedido (opcional)<input name="order_reference" maxLength={80} /></label>
    <label>Mensaje<textarea name="message" required maxLength={2000} rows={5} /></label>
    <div className={styles.honeypot} aria-hidden="true"><label>Dejá este campo vacío<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <FormError message={error} /><button className="primary-button" disabled={busy}>{busy ? "Enviando…" : "Enviar consulta"}</button>
  </form></div>;
}

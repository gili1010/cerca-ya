"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError } from "../requests/request-common";

export function PasswordSupport({ reset = false, invalid = false }: { reset?: boolean; invalid?: boolean }) {
  const [valid, setValid] = useState<boolean | null>(reset ? null : true);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const flight = useRef(false);
  useEffect(() => {
    if (!reset) return;
    let live = true;
    if (invalid) { setValid(false); return; }
    const client = getSupabaseBrowserClient();
    if (!client) { setValid(false); return; }
    client.auth.getUser().then(({ data, error }) => { if (live) setValid(!error && Boolean(data.user)); }).catch(() => { if (live) setValid(false); });
    return () => { live = false; };
  }, [reset, invalid]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (flight.current) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    const email = String(data.get("email") ?? "").trim();
    if (reset && (password.length < 6 || password.length > 256)) { setError("La contraseña debe tener entre 6 y 256 caracteres."); return; }
    if (reset && password !== data.get("repeat")) { setError("Las contraseñas deben coincidir."); return; }
    if (!reset && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)) { setError("Ingresá un email válido."); return; }
    flight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("unavailable");
      if (reset) {
        const { data: user, error: sessionError } = await client.auth.getUser();
        if (sessionError || !user.user) { setValid(false); return; }
        const { error: failure } = await client.auth.updateUser({ password });
        if (failure) {
          if (failure.status === 401 || failure.status === 403) setValid(false);
          else setError("No pudimos guardar esa contraseña. Elegí una diferente y volvé a intentar.");
          return;
        }
        setDone(true);
        // La contraseña ya se guardó: una falla al cerrar sesión no debe
        // presentarse como una falla del cambio de contraseña.
        try { await client.auth.signOut({ scope: "local" }); } catch { /* Sin detalles internos. */ }
      } else {
        // Misma respuesta tanto para cuentas existentes como inexistentes o rechazadas.
        const callback = new URL("/auth/confirm", window.location.origin);
        callback.searchParams.set("next", "/restablecer-clave");
        await client.auth.resetPasswordForEmail(email, { redirectTo: callback.toString() });
        setDone(true);
      }
    } catch { if (reset) setError("No pudimos guardar tu contraseña. Revisá tu conexión y volvé a intentar."); else setDone(true); }
    finally { flight.current = false; setBusy(false); }
  }
  if (done) return <section className="panel workflow-narrow confirmation"><h1>{reset ? "Tu contraseña fue actualizada." : "Revisá tu email"}</h1>{!reset && <p>Si existe una cuenta asociada a ese email, vas a recibir un enlace para recuperar tu contraseña.</p>}<Link className="primary-button" href="/login">Iniciar sesión</Link></section>;
  if (reset && valid === null) return <section className="panel workflow-narrow"><p role="status">Validando el enlace…</p></section>;
  if (reset && !valid) return <section className="panel workflow-narrow confirmation"><h1>Este enlace ya no es válido.</h1><Link className="primary-button" href="/recuperar-clave">Solicitar otro enlace</Link></section>;
  return <div className="workflow-narrow auth-page"><div className="workflow-heading"><h1>{reset ? "Nueva contraseña" : "Recuperá tu contraseña"}</h1>{!reset && <p>Ingresá el email de tu cuenta y te enviaremos un enlace para crear una contraseña nueva.</p>}</div><form className="panel workflow-form" onSubmit={submit}>
    {reset ? <><label>Nueva contraseña<input name="password" type="password" autoComplete="new-password" required minLength={6} maxLength={256} /></label><label>Repetir contraseña<input name="repeat" type="password" autoComplete="new-password" required minLength={6} maxLength={256} /></label></> : <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
    <FormError message={error} /><button className="primary-button" disabled={busy}>{busy ? "Un momento…" : reset ? "Guardar nueva contraseña" : "Enviar enlace"}</button><Link className="secondary-link" href="/login">Volver a iniciar sesión</Link>
  </form></div>;
}

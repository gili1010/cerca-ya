"use client";

import Link from "next/link";
import { CircleCheck, MapPin, UserRound } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { safeRedirect } from "@/lib/auth/redirect";
import { normalizeArgentinaPhone } from "@/lib/phone";
import { useAuth } from "./auth-provider";
import { GoogleSignInButton } from "./google-sign-in-button";
import { FormError } from "../requests/request-common";
import { LegalCheckbox } from "../legal/legal-checkbox";

export function AuthForm({ mode, returnTo, confirmationError = false, oauthError = false }: { mode: "login" | "signup"; returnTo: string; confirmationError?: boolean; oauthError?: boolean }) {
  const signup = mode === "signup";
  const { user, loading, error: sessionError } = useAuth();
  const [error, setError] = useState(oauthError ? "No pudimos completar el acceso con Google. Podés volver a intentarlo o ingresar con email y contraseña." : confirmationError ? "No pudimos confirmar tu email. El enlace puede haber vencido o ya haberse utilizado. Si ya confirmaste la cuenta, iniciá sesión." : "");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [created, setCreated] = useState<"confirm" | "signed-in" | null>(null);
  const [phone, setPhone] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const inFlight = useRef(false);
  const target = safeRedirect(returnTo);

  async function signInWithGoogle() {
    if (inFlight.current || loading) return;
    if (signup && !legalAccepted) { setError("Confirmá tu declaración y aceptación para continuar."); return; }
    inFlight.current = true;
    setBusy(true);
    setGoogleBusy(true);
    setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const callback = new URL("/auth/confirm", window.location.origin);
      callback.searchParams.set("redirect", target);
      callback.searchParams.set("flow", "google");
      const { error: failure } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
      });
      if (failure) throw failure;
    } catch {
      setError("No pudimos iniciar el acceso con Google. Revisá tu conexión y volvé a intentar, o ingresá con email y contraseña.");
    } finally {
      inFlight.current = false;
      setBusy(false);
      setGoogleBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "").trim();
    const phone = String(data.get("phone") ?? "").trim();
    if (signup && !legalAccepted) { setError("Confirmá tu declaración y aceptación para crear tu cuenta."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Ingresá un email válido."); return; }
    if (signup && (!name || name.length > 160)) { setError("Ingresá tu nombre completo, de hasta 160 caracteres."); return; }
    if (password.length < (signup ? 6 : 1)) { setError("La contraseña debe tener al menos 6 caracteres."); return; }
    if (signup && password !== String(data.get("passwordConfirmation") ?? "")) { setError("Las contraseñas deben coincidir."); return; }
    if (phone.length > 40) { setError("Ingresá un teléfono de hasta 40 caracteres."); return; }
    if (signup && phone && !normalizeArgentinaPhone(phone)) { setError("Ingresá un teléfono de Argentina con código de área y número (10 dígitos, sin 0 ni 15), o con +54."); return; }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) { setError("No pudimos acceder a tu cuenta en este momento. Volvé a intentar más tarde."); return; }
      if (signup) {
        const callback = new URL("/auth/confirm", window.location.origin);
        callback.searchParams.set("redirect", target);
        const result = await client.auth.signUp({ email, password, options: { data: { full_name: name, phone: normalizeArgentinaPhone(phone), legal_accepted: true }, emailRedirectTo: callback.toString() } });
        if (result.error) throw result.error;
        if (result.data.user?.identities?.length === 0) { setError("El email ya está registrado. Probá iniciar sesión."); return; }
        form.reset();
        setPhone("");
        setLegalAccepted(false);
        setCreated(result.data.session ? "signed-in" : "confirm");
      } else {
        const result = await client.auth.signInWithPassword({ email, password });
        if (result.error) throw result.error;
        form.reset();
        // A full navigation avoids stale prefetched anonymous server pages.
        window.location.assign(target);
      }
    } catch (cause) { setError(authErrorMessage(cause, signup ? "signup" : "login")); }
    finally { inFlight.current = false; setBusy(false); }
  }

  if (created) return <section className="panel workflow-narrow confirmation auth-confirmation"><span className="confirmation-icon"><CircleCheck size={30} aria-hidden="true" /></span><h1>Cuenta creada.</h1><p>{created === "confirm" ? "Revisá tu email para confirmar la cuenta." : "Tu sesión ya está activa. Podés continuar."}</p>{created === "confirm" && <p className="info-note">Revisá también la carpeta de spam. Después de confirmar vas a poder continuar en CercaYa.</p>}<Link className="primary-button" href={created === "signed-in" ? target : `/login?redirect=${encodeURIComponent(target)}`}>{created === "signed-in" ? "Continuar" : "Ir a iniciar sesión"}</Link></section>;
  if (!loading && user) return <section className="panel workflow-narrow confirmation auth-confirmation"><span className="confirmation-icon"><UserRound size={30} aria-hidden="true" /></span><h1>Ya tenés una sesión activa</h1><Link className="primary-button" href={target}>Continuar</Link><Link className="secondary-link" href="/cuenta">Ir a Mi cuenta</Link></section>;
  return <div className="workflow-narrow auth-page"><div className="auth-identity"><MapPin size={24} aria-hidden="true" /><span>Encontralo cerca. Tenelo hoy.</span></div><div className="workflow-heading"><h1>{signup ? "Crear cuenta" : "Iniciar sesión"}</h1><p>{signup ? "Tu cuenta para encontrar lo que necesitás cerca." : "Entrá con tu email y contraseña."}</p></div><form className="workflow-form panel" onSubmit={submit}>
    {signup && <LegalCheckbox checked={legalAccepted} onChange={setLegalAccepted} disabled={busy} />}
    <GoogleSignInButton onClick={() => void signInWithGoogle()} disabled={busy || loading || (signup && !legalAccepted)} busy={googleBusy} />
    {signup && <label>Nombre completo<input name="name" autoComplete="name" required maxLength={160} /></label>}
    <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>
    {signup && <label>Teléfono · Argentina (+54)<input name="phone" type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} placeholder="Ej. 3547 123456" /><small>Opcional. Incluí el código de área, sin 0 ni 15. Agregamos +54 automáticamente.</small></label>}
    <label>Contraseña<input name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 6 : undefined} maxLength={256} /></label>
    {!signup && <Link className="secondary-link" href="/recuperar-clave">¿Olvidaste tu contraseña?</Link>}
    {signup && <label>Confirmar contraseña<input name="passwordConfirmation" type="password" autoComplete="new-password" required minLength={6} maxLength={256} /></label>}
    <FormError message={error || sessionError} /><button className="primary-button" type="submit" disabled={busy || loading || (signup && !legalAccepted)}>{busy ? "Un momento…" : signup ? "Crear cuenta" : "Iniciar sesión"}</button>
    <Link className="secondary-link" href={`${signup ? "/login" : "/registro"}?redirect=${encodeURIComponent(target)}`}>{signup ? "Ya tengo cuenta. Iniciar sesión" : "No tengo cuenta. Registrarme"}</Link>
  </form></div>;
}

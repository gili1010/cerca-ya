"use client";
import { useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { LegalCheckbox } from "./legal-checkbox";
export function LegalAcceptanceGate({ children }: { children: ReactNode }) {
  const { user, profile, profileLoading, profileError, retryProfile } = useAuth();
  const path = usePathname();
  const [acceptedFor, setAcceptedFor] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const inFlight = useRef(false);
  if (!user || ["/privacidad", "/terminos", "/reglas-comercios"].includes(path)) return children;
  if (profileLoading) return <main className="shell detail-page"><p role="status">Cargando tu cuenta…</p></main>;
  if (profile?.terms_accepted_at && profile.privacy_accepted_at) return children;
  const accepted = acceptedFor === user.id;
  return <main className="shell detail-page"><section className="workflow-narrow panel workflow-form"><h1>Para continuar en CercaYa</h1><p>Confirmá tu declaración y leé cómo funciona CercaYa.</p>{profileError ? <><p role="alert" className="form-error">No pudimos cargar tu cuenta.</p><button className="outline-button" onClick={retryProfile}>Reintentar</button></> : <form className="workflow-form" onSubmit={async event => {
    event.preventDefault(); if (!accepted || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("unavailable");
      const { error: failure } = await client.rpc("accept_my_legal_terms", { p_accept: true });
      if (failure) throw failure;
      retryProfile();
    } catch { setError("No pudimos guardar tu aceptación. Volvé a intentar."); }
    finally { inFlight.current = false; setBusy(false); }
  }}><LegalCheckbox checked={accepted} onChange={checked => setAcceptedFor(checked ? user.id : null)} disabled={busy} />{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={!accepted || busy}>{busy ? "Guardando…" : "Continuar"}</button></form>}<button className="secondary-link" disabled={busy} onClick={async () => {
    try { const client = getSupabaseBrowserClient(); if (!client) throw new Error(); const { error } = await client.auth.signOut({ scope: "local" }); if (error) throw error; }
    catch { setError("No pudimos cerrar la sesión. Volvé a intentar."); }
  }}>Cerrar sesión</button></section></main>;
}

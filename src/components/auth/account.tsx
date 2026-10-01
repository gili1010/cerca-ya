"use client";

import Link from "next/link";
import { ArrowUpRight, ClipboardList, Heart, PackageCheck, Store, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { formatArgentinaPhone } from "@/lib/phone";
import { FormError } from "../requests/request-common";
import { useMyBusiness } from "../businesses/business-provider";

export function Account() {
  const { user, profile, profileLoading, profileError, retryProfile } = useAuth();
  const { business, loading: businessLoading, error: businessError, refresh } = useMyBusiness();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function signOut() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const result = await client.auth.signOut({ scope: "local" });
      if (result.error) throw result.error;
      window.location.assign("/");
    } catch (cause) { setError(authErrorMessage(cause, "logout")); setBusy(false); }
  }
  return <div className="workflow-narrow"><div className="workflow-heading"><span className="eyebrow">TU ESPACIO EN CERCAYA</span><h1>Mi cuenta</h1></div><section className="panel">
    <div className="account-profile-title"><UserRound size={22} aria-hidden="true" /><h2>Tu perfil</h2></div>
    {profileLoading ? <p role="status">Cargando tu perfil…</p> : <><FormError message={profileError} />{profileError && <button className="outline-button" onClick={retryProfile}>Reintentar perfil</button>}<dl className="request-facts"><div><dt>Nombre</dt><dd>{profile?.full_name || "Sin nombre registrado"}</dd></div><div><dt>Email</dt><dd className="auth-email">{user?.email}</dd></div><div><dt>Teléfono</dt><dd>{profile?.phone ? formatArgentinaPhone(profile.phone) : "Sin teléfono registrado"}</dd></div></dl></>}
    <div className="account-links"><Link href="/pedidos"><span><ClipboardList size={20} aria-hidden="true" />Mis pedidos</span><ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/reservas"><span><PackageCheck size={20} aria-hidden="true" />Mis reservas</span><ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/guardados"><span><Heart size={20} aria-hidden="true" />Guardados</span><ArrowUpRight size={18} aria-hidden="true" /></Link>{businessLoading ? <p role="status">Consultando tu comercio…</p> : businessError ? <div><FormError message={businessError} /><button className="outline-button" onClick={() => void refresh().catch(() => {})}>Reintentar comercio</button></div> : <Link href={business ? "/comercio/mi-negocio" : "/comercio/crear"}><span><Store size={20} aria-hidden="true" />{business ? <span>Mi comercio<small>{business.name}</small></span> : "Vender en CercaYa"}</span><ArrowUpRight size={18} aria-hidden="true" /></Link>}</div>
    <p className="info-note">Tu cuenta, perfil, pedidos, ofertas y reservas se guardan en Supabase.</p>
    <FormError message={error} /><button className="outline-button account-signout" disabled={busy} onClick={signOut}>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</button>
  </section></div>;
}


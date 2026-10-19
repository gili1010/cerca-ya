"use client";

import { LogOut, MapPin, Store, UserRound, Wrench, Settings2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/auth/errors";
import { formatArgentinaPhone } from "@/lib/phone";
import { FormError } from "../requests/request-common";
import { useMyBusiness } from "../businesses/business-provider";
import { BuyerLocationControls } from "../location/buyer-location-controls";
import { ActivityMenu } from "../navigation/activity-menu";
import { NavigationItem } from "../navigation/navigation-item";
import { BackLink } from "../navigation/back-link";
import styles from "./account.module.css";

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
  return <div className={styles.page}>
    <BackLink href="/">Volver a CercaYa</BackLink>
    <header className={styles.heading}><div><span className="eyebrow">UNA CUENTA, MUCHAS FORMAS DE PARTICIPAR</span><h1>Mi cuenta</h1><p>Tus datos personales y la configuración que usás en CercaYa.</p></div></header>
    <section className={styles.activityAccess} aria-label="Acceso a Mi actividad"><div><strong>¿Querés continuar donde quedaste?</strong><p>Reservas, publicaciones, solicitudes y oportunidades están en Mi actividad.</p></div><ActivityMenu entry/></section>
    <div className={styles.columns}>
      <div className={styles.stack}>
        <section className={styles.panel} aria-labelledby="account-personal-title">
          <div className={styles.identity}><span className={styles.avatar}><UserRound size={28} aria-hidden="true"/></span><div><span className={styles.kicker}>TU PERFIL</span><h2 id="account-personal-title">{profileLoading ? "Datos personales" : profile?.full_name || "Datos personales"}</h2></div></div>
          {profileLoading ? <p role="status">Cargando tu perfil…</p> : <><FormError message={profileError}/>{profileError && <button type="button" className="outline-button" onClick={retryProfile}>Reintentar perfil</button>}
          <dl className={styles.facts}><div><dt>Nombre</dt><dd>{profileError ? "No disponible en este momento" : profile?.full_name || "Sin nombre registrado"}</dd></div><div><dt>Email de tu cuenta</dt><dd>{user?.email || "Sin email disponible"}</dd></div><div><dt>Teléfono de tu perfil</dt><dd>{profileError ? "No disponible en este momento" : profile?.phone ? formatArgentinaPhone(profile.phone) : "Sin teléfono registrado"}</dd></div></dl></>}
          <p className={styles.hint}>Estos datos pertenecen a tu cuenta. El contacto público de tus artículos y servicios se configura por separado al publicar.</p>
        </section>
        <section className={styles.panel} aria-labelledby="account-location-title"><div className={styles.sectionTitle}><MapPin size={21} aria-hidden="true"/><h2 id="account-location-title">Ubicación para explorar</h2></div><div className={styles.location}><BuyerLocationControls/></div></section>
      </div>
      <div className={styles.stack}>
        <details className={`${styles.panel} ${styles.settings}`}><summary><Settings2 size={21} aria-hidden="true"/><span>Perfil profesional y comercio</span></summary><p className={styles.hint}>Configurá cómo te presentás y dónde trabajás. No necesitás cambiar de cuenta.</p>
          <NavigationItem href="/mi-perfil-profesional" label="Mi perfil profesional" description="Presentación, contacto autorizado y localidades donde trabajás" icon={Wrench}/>
          {businessLoading ? <p role="status">Consultando tu comercio…</p> : businessError ? <div><FormError message={businessError}/><button type="button" className="outline-button" onClick={() => void refresh().catch(() => {})}>Reintentar comercio</button></div> : <NavigationItem href={business ? "/comercio/mi-negocio" : "/comercio/crear"} label={business ? "Configuración de mi comercio" : "Crear mi tienda"} description={business ? business.name : "Empezá a vender desde un comercio"} icon={Store}/>}
        </details>
        <section className={styles.panel} aria-labelledby="account-session-title"><div className={styles.sectionTitle}><LogOut size={21} aria-hidden="true"/><h2 id="account-session-title">Tu sesión</h2></div><p className={styles.hint}>Podés cerrar sesión en este navegador cuando termines.</p><FormError message={error}/><button type="button" className={`outline-button ${styles.signout}`} disabled={busy} onClick={signOut}><LogOut size={18} aria-hidden="true"/>{busy ? "Cerrando sesión…" : "Cerrar sesión"}</button></section>
      </div>
    </div>
  </div>;
}

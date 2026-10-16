"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, MapPin, UserRound, Plus, House, Search } from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import { Brand } from "./brand";
import { CartAccess } from "../cart/cart-access";
import { ActivityMenu } from "../navigation/activity-menu";
import { navigationSection, type NavigationSection } from "../navigation/navigation-section";
import styles from "../navigation/global-navigation.module.css";

interface HeaderProps {
  zone: string;
  onZone: () => void;
  onAccount: () => void;
  onExplore: () => void;
  onRequests: () => void;
  onHow: () => void;
  activeNavigation?: NavigationSection;
}

export function Header({ zone, onZone, onAccount, onExplore, onRequests, onHow, activeNavigation }: HeaderProps) {
  const { user, profile, loading } = useAuth();
  const path = usePathname(), section = navigationSection(path,activeNavigation);
  const accountLabel = user ? profile?.full_name.trim().split(/\s+/)[0] || "Mi cuenta" : "Iniciar sesión";
  const itemClass = (value: NavigationSection) => `${styles.topItem} ${section === value ? styles.active : ""}`;
  return <header className={styles.header} id="inicio">
    <div className={`shell ${styles.headerInner}`}>
      <div className={styles.brandBlock}><Brand/><small>Encontralo cerca. Tenelo hoy.</small></div>
      <button type="button" className={styles.zone} onClick={onZone} aria-label={`Cambiar ubicación: ${zone}`}><MapPin size={18} aria-hidden="true"/><span><small>Tu ubicación</small><strong>{zone}</strong></span><ChevronDown size={14} aria-hidden="true"/></button>
      <nav className={styles.desktopNav} aria-label="Navegación principal">
        <Link href="/" className={itemClass("home")} aria-current={section === "home" ? "page" : undefined}><House size={17} aria-hidden="true"/>Inicio</Link>
        <button type="button" className={itemClass("search")} onClick={onExplore} aria-current={section === "search" ? "page" : undefined}><Search size={17} aria-hidden="true"/>Buscar</button>
        <Link href="/publicar" className={itemClass("publish")} aria-current={section === "publish" ? "page" : undefined}><Plus size={17} aria-hidden="true"/>Publicar</Link>
        <ActivityMenu active={section === "activity"} onRequests={onRequests} onHow={onHow}/>
      </nav>
      <div className={styles.utilities}><CartAccess/><button type="button" className={`${styles.account} ${section === "account" ? styles.active : ""}`} onClick={onAccount} disabled={loading} aria-label={user ? "Mi cuenta" : "Iniciar sesión"}><UserRound size={18} aria-hidden="true"/><span>{accountLabel}</span></button></div>
    </div>
  </header>;
}

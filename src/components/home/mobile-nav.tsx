"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Search, Plus, UserRound } from "lucide-react";
import { ActivityMenu } from "../navigation/activity-menu";
import { navigationSection } from "../navigation/navigation-section";
import styles from "../navigation/global-navigation.module.css";

// Preserve existing callers and their handlers; saved/orders are grouped in Activity.
export type MobileTab = "home" | "search" | "requests" | "saved" | "account";
export function MobileNav({ active, onSelect }: { active: MobileTab; savedCount: number; onSelect: (tab: MobileTab) => void }) {
 const path = usePathname();
 const section = navigationSection(path,active === "requests" || active === "saved" ? "activity" : active);
 const itemClass = (value: string) => `${styles.bottomItem} ${section === value ? styles.active : ""}`;
 return <nav className={styles.bottomNav} aria-label="Navegación principal móvil">
   <button type="button" className={itemClass("home")} onClick={() => onSelect("home")} aria-current={section === "home" ? "page" : undefined}><span className={styles.navIcon}><House size={21} aria-hidden="true"/></span>Inicio</button>
   <button type="button" className={itemClass("search")} onClick={() => onSelect("search")} aria-current={section === "search" ? "page" : undefined}><span className={styles.navIcon}><Search size={21} aria-hidden="true"/></span>Buscar</button>
   <Link href="/publicar" className={itemClass("publish")} aria-current={section === "publish" ? "page" : undefined}><span className={styles.navIcon}><Plus size={21} aria-hidden="true"/></span>Publicar</Link>
   <ActivityMenu mobile active={section === "activity"} onRequests={() => onSelect("requests")} onSaved={() => onSelect("saved")}/>
   <button type="button" className={itemClass("account")} onClick={() => onSelect("account")} aria-current={section === "account" ? "page" : undefined}><span className={styles.navIcon}><UserRound size={21} aria-hidden="true"/></span>Cuenta</button>
 </nav>;
}

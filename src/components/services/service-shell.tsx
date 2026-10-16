"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PersonalShell } from "@/components/personal-listings/personal-shell";
import styles from "@/components/personal-listings/personal-listings.module.css";
export function ServiceShell({children}:{children:ReactNode}) {
 const path=usePathname();
 return <PersonalShell><nav className={styles.nav} aria-label="Servicios y perfil profesional">
  <Link href="/publicar/servicio" aria-current={path==="/publicar/servicio"?"page":undefined}>Ofrecer un servicio</Link>
  <Link href="/mis-servicios" aria-current={path.startsWith("/mis-servicios")?"page":undefined}>Mis servicios</Link>
  <Link href="/mi-perfil-profesional" aria-current={path==="/mi-perfil-profesional"?"page":undefined}>Mi perfil profesional</Link>
  <Link href="/radar-servicios" aria-current={path.startsWith("/radar-servicios")?"page":undefined}>Radar de servicios</Link>
  <Link href="/mis-propuestas-servicio" aria-current={path.startsWith("/mis-propuestas-servicio")?"page":undefined}>Mis propuestas</Link>
 </nav><div style={{marginTop:"var(--space-5)"}}>{children}</div></PersonalShell>;
}


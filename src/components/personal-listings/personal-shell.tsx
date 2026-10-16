"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { GlobalHeader, GlobalMobileNav } from "@/components/navigation/global-shell-navigation";
import { BackLink } from "@/components/navigation/back-link";
import styles from "./personal-listings.module.css";

export function PersonalShell({ children }: { children: ReactNode }) {
  return <><GlobalHeader/><main className={`shell ${styles.main}`}>{children}</main>
    <footer className={`shell ${styles.footer}`}><BackLink href="/">Volver a CercaYa</BackLink><nav aria-label="Información"><Link href="/terminos">Términos y Condiciones</Link><Link href="/privacidad">Privacidad</Link><Link href="/contacto">Contacto</Link></nav></footer><GlobalMobileNav/></>;
}

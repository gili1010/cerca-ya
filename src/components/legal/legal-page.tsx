import Link from "next/link";
import type { ReactNode } from "react";
import { DetailShell } from "@/components/details/detail-shell";
import styles from "@/app/privacidad/privacy.module.css";
export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return <DetailShell><article className={styles.page}><Link className={styles.backLink} href="/"><span className={styles.backArrow} aria-hidden="true">←</span><span>Volver a CercaYa</span></Link><header className={styles.heading}><span className="eyebrow">CERCAYA · INFORMACIÓN CLARA</span><h1>{title}</h1><p>{intro}</p><p className={styles.updated}>Última actualización: 7 de octubre de 2026</p></header><div className={`panel ${styles.content}`}>{children}</div></article></DetailShell>;
}

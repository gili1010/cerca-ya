"use client";

import { useSearchParams } from "next/navigation";
import { personalSearchReturnTo } from "@/lib/search-navigation";
import { BackLink } from "@/components/navigation/back-link";
import styles from "./public-details.module.css";

export function DetailUnavailable() {
  const params = useSearchParams();
  return <section className={`${styles.page} ${styles.summary}`}><h1>Esta publicación no está disponible</h1><p>El enlace puede haber cambiado o el contenido ya no está publicado.</p><BackLink href={personalSearchReturnTo(params.get("returnTo"))}>Volver a resultados</BackLink></section>;
}

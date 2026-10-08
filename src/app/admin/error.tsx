"use client";
import styles from "@/components/admin/admin.module.css";
export default function AdminError({ reset }: { reset: () => void }) { return <section className={styles.detail}><h2>No pudimos abrir esta sección.</h2><p>Volvé a intentar en unos momentos.</p><button className={styles.button} onClick={reset}>Reintentar</button></section>; }

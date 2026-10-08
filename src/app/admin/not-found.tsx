import Link from "next/link";
import styles from "@/components/admin/admin.module.css";
export default function AdminNotFound() { return <section className={styles.detail}><h1>Recurso no encontrado</h1><p>Revisá la dirección o buscá el recurso en los listados.</p><Link className={styles.button} href="/admin">Volver al resumen</Link></section>; }

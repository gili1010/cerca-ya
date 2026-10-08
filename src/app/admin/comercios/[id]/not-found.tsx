import Link from "next/link";
import styles from "@/components/admin/admin.module.css";
export default function AdminBusinessNotFound() { return <section className={styles.detail}><h1>Comercio no encontrado</h1><p>Revisá la dirección o buscá el comercio en el listado.</p><Link className={styles.button} href="/admin/comercios">Volver a comercios</Link></section>; }

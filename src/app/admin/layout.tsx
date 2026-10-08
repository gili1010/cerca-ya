import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/server";
import styles from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Administración | CercaYa", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin("/admin");
  return <div className={styles.shell}><header className={styles.topbar}><Link href="/admin" className={styles.brand}>CercaYa <span>Admin</span></Link><Link className={styles.button} href="/">Volver a CercaYa</Link></header><div className={styles.workspace}><nav className={styles.nav} aria-label="Administración"><Link href="/admin">Resumen</Link><Link href="/admin/comercios">Comercios</Link><Link href="/admin/productos">Productos</Link><Link href="/admin/usuarios">Usuarios</Link><Link href="/admin/pedidos">Pedidos</Link><Link href="/admin/reportes">Reportes</Link><Link href="/admin/auditoria">Auditoría</Link></nav><main className={styles.main}>{children}</main></div></div>;
}

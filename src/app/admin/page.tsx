import { readAdminPhase2 } from "@/lib/admin/server";
import type { AdminMetrics } from "@/lib/admin/types";
import { AdminHeading } from "@/components/admin/admin-common";
import styles from "@/components/admin/admin.module.css";
import { defaultAnalyticsFilters, readAnalytics } from "@/lib/admin/analytics";
import analyticsStyles from "@/components/admin/analytics.module.css";
import Link from "next/link";

export default async function AdminPage() {
  const metrics = await readAdminPhase2<AdminMetrics>("dashboard", "/admin");
  // Una migración pendiente o una falla de analítica no rompe el resumen actual.
  const analytics = await readAnalytics({ ...defaultAnalyticsFilters, days: 7 }, "/admin").catch(() => null);
  const values = [["Usuarios activos", metrics.active_users], ["Usuarios suspendidos", metrics.suspended_users], ["Reportes pendientes", metrics.open_reports], ["Comercios", metrics.businesses], ["Comercios activos", metrics.active_businesses], ["Productos activos públicos", metrics.active_products], ["Pedidos totales", metrics.orders], ["Pedidos en los últimos 7 días", metrics.recent_orders]] as const;
  return <><AdminHeading title="Resumen" description="Estado actual de la plataforma." /><dl className={styles.metrics}>{values.map(([label, value]) => <div className={styles.metric} key={label}><dt>{label}</dt><dd>{value.toLocaleString("es-AR")}</dd></div>)}</dl><p className={styles.muted}>Pedidos cuenta reservas de todos los estados, incluidos los pedidos de varios productos; cada pedido se cuenta una vez.</p><section className={analyticsStyles.dashboard}><h2>Demanda de productos</h2>{analytics ? <dl className={styles.metrics}><div className={styles.metric}><dt>Búsquedas últimos 7 días</dt><dd>{analytics.summary.total.toLocaleString("es-AR")}</dd></div><div className={styles.metric}><dt>Sin resultados últimos 7 días</dt><dd>{analytics.summary.without_results.toLocaleString("es-AR")}</dd></div></dl> : <p className={styles.muted}>La analítica no está disponible en este momento.</p>}<Link className={styles.button} href="/admin/analitica">Ver analítica</Link></section></>;
}

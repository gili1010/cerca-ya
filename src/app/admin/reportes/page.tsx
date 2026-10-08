import Link from "next/link";
import { readAdminPhase2 } from "@/lib/admin/server";
import type { AdminPage, AdminParams } from "@/lib/admin/types";
import { parseSupportFilters, reportStatusLabels, type AdminReport } from "@/lib/admin/phase2-types";
import { AdminEmpty, AdminHeading, adminDate } from "@/components/admin/admin-common";
import { SupportBadge, SupportFiltersForm, SupportPagination } from "@/components/admin/support-common";
import styles from "@/components/admin/admin.module.css";
export default async function ReportsPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const filters = parseSupportFilters(await searchParams, "reports");
  const data = await readAdminPhase2<AdminPage<AdminReport>>("reports", "/admin/reportes", filters);
  return <><AdminHeading title="Reportes" description="Denuncias de comercios y productos. Pendientes primero por defecto." /><SupportFiltersForm section="reports" filters={filters} /><section className={styles.panel}>{data.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Reportes"><table className={styles.table}><thead><tr><th scope="col">Fecha</th><th scope="col">Recurso</th><th scope="col">Tipo</th><th scope="col">Motivo</th><th scope="col">Reportante</th><th scope="col">Estado</th></tr></thead><tbody>{data.rows.map(r => <tr key={r.id}><td>{adminDate(r.created_at)}</td><td><Link href={`/admin/reportes/${r.id}`}>{r.resource_name || "Recurso no disponible"}</Link></td><td>{r.entity_type === "business" ? "Comercio" : "Producto"}</td><td>{r.reason}</td><td><Link href={`/admin/usuarios/${r.reporter_user_id}`}>{r.reporter_name || "Sin nombre"}</Link></td><td><SupportBadge label={reportStatusLabels[r.status]} warning={r.status === "OPEN"} /></td></tr>)}</tbody></table></div> : <AdminEmpty />}</section><SupportPagination path="/admin/reportes" filters={filters} total={data.total} /></>;
}

import Link from "next/link";
import { readAdminPhase2 } from "@/lib/admin/server";
import { parseAdminFilters, type AdminAudit, type AdminPage, type AdminParams } from "@/lib/admin/types";
import { AdminEmpty, AdminHeading, AdminPagination, adminDate } from "@/components/admin/admin-common";
import styles from "@/components/admin/admin.module.css";

const labels = { BUSINESS_SUSPENDED: "Comercio suspendido", BUSINESS_REACTIVATED: "Suspensión retirada", PRODUCT_BLOCKED: "Producto bloqueado", PRODUCT_UNBLOCKED: "Bloqueo retirado", USER_SUSPENDED: "Usuario suspendido", USER_REACTIVATED: "Usuario reactivado", REPORT_RESOLVED: "Reporte resuelto", REPORT_DISMISSED: "Reporte descartado" };
const types = { business: "Comercio", product: "Producto", user: "Usuario", report: "Reporte" };
const routes = { business: "/admin/comercios", product: "/admin/productos", user: "/admin/usuarios", report: "/admin/reportes" };
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const filters = { ...parseAdminFilters(await searchParams), query: "", businessQuery: "", state: "all" as const };
  const data = await readAdminPhase2<AdminPage<AdminAudit>>("audit", "/admin/auditoria", undefined, undefined, filters.page);
  return <><AdminHeading title="Auditoría" description="Registro de acciones administrativas. Sólo lectura, más recientes primero." /><section className={styles.panel}>{data.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Auditoría administrativa"><table className={styles.table}><thead><tr><th scope="col">Fecha</th><th scope="col">Administrador</th><th scope="col">Acción</th><th scope="col">Tipo</th><th scope="col">Recurso</th><th scope="col">Motivo / nota</th></tr></thead><tbody>{data.rows.map(a => <tr key={a.id}><td>{adminDate(a.created_at)}</td><td>{a.admin_name || "Administrador"}<small className={styles.identifier}>{a.admin_user_id}</small></td><td>{labels[a.action]}</td><td>{types[a.entity_type]}</td><td><Link href={`${routes[a.entity_type]}/${a.entity_id}`}>{a.resource_name || types[a.entity_type]}</Link><small className={styles.identifier}>{a.entity_id}</small></td><td>{a.reason || "Sin motivo adicional"}{a.note && <small>{a.note}</small>}</td></tr>)}</tbody></table></div> : <AdminEmpty />}</section><AdminPagination path="/admin/auditoria" filters={filters} total={data.total} /></>;
}

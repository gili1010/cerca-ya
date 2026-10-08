import Link from "next/link";
import { readAdminPhase2 } from "@/lib/admin/server";
import type { AdminPage, AdminParams } from "@/lib/admin/types";
import { parseSupportFilters, type AdminUser } from "@/lib/admin/phase2-types";
import { AdminEmpty, AdminHeading, adminDate } from "@/components/admin/admin-common";
import { SupportBadge, SupportFiltersForm, SupportPagination } from "@/components/admin/support-common";
import styles from "@/components/admin/admin.module.css";
export default async function UsersPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const filters = parseSupportFilters(await searchParams, "users");
  const data = await readAdminPhase2<AdminPage<AdminUser>>("users", "/admin/usuarios", filters);
  return <><AdminHeading title="Usuarios" description="Información básica y acceso a soporte. El teléfono sólo aparece en el detalle." /><SupportFiltersForm section="users" filters={filters} /><section className={styles.panel}>{data.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Usuarios"><table className={styles.table}><thead><tr><th scope="col">Usuario</th><th scope="col">Email</th><th scope="col">Registro</th><th scope="col">Estado</th><th scope="col">Pedidos</th><th scope="col">Comercio</th></tr></thead><tbody>{data.rows.map(u => <tr key={u.id}><td><Link href={`/admin/usuarios/${u.id}`}>{u.name || "Sin nombre"}</Link>{u.is_admin && <small>Administrador</small>}</td><td>{u.email || "Sin informar"}</td><td>{adminDate(u.created_at)}</td><td><SupportBadge label={u.suspended_at ? "Suspendido" : "Activo"} warning={Boolean(u.suspended_at)} /></td><td>{u.order_count}</td><td>{u.businesses.length ? u.businesses.map(b => <div key={b.id}><Link href={`/admin/comercios/${b.id}`}>{b.name}</Link></div>) : "Sin comercio"}</td></tr>)}</tbody></table></div> : <AdminEmpty />}</section><SupportPagination path="/admin/usuarios" filters={filters} total={data.total} /></>;
}

import Link from "next/link";
import { readAdmin } from "@/lib/admin/server";
import { parseAdminFilters, type AdminBusiness, type AdminPage, type AdminParams } from "@/lib/admin/types";
import { AdminBadge, AdminEmpty, AdminFiltersForm, AdminHeading, AdminPagination, adminDate } from "@/components/admin/admin-common";
import { AdminStatusAction } from "@/components/admin/admin-status-action";
import styles from "@/components/admin/admin.module.css";

export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const filters = parseAdminFilters(await searchParams);
  const data = await readAdmin<AdminPage<AdminBusiness>>("businesses", "/admin/comercios", filters);
  return <><AdminHeading title="Comercios" description="Revisá comercios y administrá su presencia pública." /><AdminFiltersForm filters={filters} /><section className={styles.panel}>{data.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Listado de comercios"><table className={styles.table}><thead><tr><th scope="col">Comercio</th><th scope="col">Propietario</th><th scope="col">Categorías</th><th scope="col">Alta</th><th scope="col">Estado</th><th scope="col">Productos</th><th scope="col">Acciones</th></tr></thead><tbody>{data.rows.map(b => <tr key={b.id}><td><Link href={`/admin/comercios/${b.id}`}>{b.name}</Link><small>{b.city || "Localidad sin informar"}</small></td><td>{b.owner_name || "Sin nombre informado"}</td><td>{b.categories.join(", ") || "Sin categorías"}</td><td>{adminDate(b.created_at)}</td><td><AdminBadge active={b.active} blocked={Boolean(b.admin_suspended_at)} business /></td><td>{b.product_count}</td><td><AdminStatusAction entity="business" id={b.id} name={b.name} blocked={Boolean(b.admin_suspended_at)} /></td></tr>)}</tbody></table></div> : <AdminEmpty />}</section><AdminPagination path="/admin/comercios" filters={filters} total={data.total} /></>;
}

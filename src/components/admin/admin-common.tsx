import Link from "next/link";
import { adminPageHref, adminPageSize, type AdminFilters } from "@/lib/admin/types";
import styles from "./admin.module.css";

export function AdminHeading({ title, description }: { title: string; description: string }) {
  return <header className={styles.heading}><span>ADMINISTRACIÓN</span><h1>{title}</h1><p>{description}</p></header>;
}
export function AdminBadge({ active, blocked, business = false }: { active: boolean; blocked: boolean; business?: boolean }) {
  return <span className={`${styles.badge} ${blocked ? styles.blocked : active ? styles.active : styles.inactive}`}>{blocked ? business ? "Suspendido" : "Bloqueado por administración" : active ? "Activo" : business ? "Inactivo" : "Inactivo por comerciante"}</span>;
}
export function AdminFiltersForm({ filters, products = false }: { filters: AdminFilters; products?: boolean }) {
  return <form className={styles.filters} method="get">
    <label>{products ? "Producto" : "Comercio"}<input name="q" defaultValue={filters.query} maxLength={160} placeholder="Buscar por nombre" /></label>
    {products && <label>Comercio<input name="comercio" defaultValue={filters.businessQuery} maxLength={160} placeholder="Nombre del comercio" /></label>}
    <label>Estado<select name="estado" defaultValue={filters.state}><option value="all">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos (todos)</option><option value="blocked">{products ? "Bloqueados por administración" : "Suspendidos"}</option></select></label>
    <button className={styles.primaryButton} type="submit">Filtrar</button>
  </form>;
}
export function AdminPagination({ path, filters, total }: { path: string; filters: AdminFilters; total: number }) {
  const pages = Math.max(1, Math.ceil(total / adminPageSize));
  return <nav aria-label="Paginación" className={styles.pagination}>
    <span>{total} resultados · Página {filters.page} de {pages}</span>
    <div>{filters.page > 1 && <Link className={styles.button} href={adminPageHref(path, filters, filters.page - 1)}>Anterior</Link>}{filters.page < pages && <Link className={styles.button} href={adminPageHref(path, filters, filters.page + 1)}>Siguiente</Link>}{filters.page > pages && <Link className={styles.button} href={adminPageHref(path, filters, 1)}>Volver al inicio</Link>}</div>
  </nav>;
}
export function AdminEmpty() { return <p className={styles.empty}>No hay resultados para esta página. Ajustá los filtros o volvé a la primera página.</p>; }
export function adminDate(value: string) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Argentina/Cordoba" }).format(new Date(value)); }

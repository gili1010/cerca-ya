import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { adminPageSize } from "@/lib/admin/types";
import { orderStatusLabels, reportStatusLabels, supportHref, type SupportFilters } from "@/lib/admin/phase2-types";
import styles from "./admin.module.css";

export function SupportFiltersForm({ filters, section }: { filters: SupportFilters; section: "users" | "orders" | "reports" }) {
  return <form className={styles.filters} method="get">
    {section !== "reports" && <label>{section === "users" ? "Nombre, email o teléfono" : "Número de pedido"}<input name="q" defaultValue={filters.q} maxLength={160} placeholder={section === "users" ? "Buscar usuario" : "ID corto o completo"} /></label>}
    {section === "orders" && <><label>Comprador<input name="comprador" defaultValue={filters.buyer} maxLength={160} placeholder="Nombre o ID de usuario" /></label><label>Comercio<input name="comercio" defaultValue={filters.business} maxLength={160} placeholder="Nombre del comercio" /></label></>}
    <label>Estado<select name="estado" defaultValue={filters.state}><option value="all">Todos</option>{section === "users" ? <><option value="active">Activos</option><option value="suspended">Suspendidos</option></> : Object.entries(section === "orders" ? orderStatusLabels : reportStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    {section === "orders" && <><label>Modalidad<select name="modalidad" defaultValue={filters.mode}><option value="all">Todas</option><option value="PICKUP">Retiro</option><option value="DELIVERY">Envío</option></select></label><label>Desde<input type="date" name="desde" defaultValue={filters.from} /></label><label>Hasta<input type="date" name="hasta" defaultValue={filters.to} /></label></>}
    <button className={styles.primaryButton} type="submit">Filtrar</button>
  </form>;
}
export function SupportPagination({ path, filters, total }: { path: string; filters: SupportFilters; total: number }) {
  const pages = Math.max(1, Math.ceil(total / adminPageSize));
  return <nav aria-label="Paginación" className={styles.pagination}><span>{total} resultados · Página {filters.page} de {pages}</span><div>{filters.page > 1 && <Link className={styles.button} href={supportHref(path, filters, filters.page - 1)}>Anterior</Link>}{filters.page < pages && <Link className={styles.button} href={supportHref(path, filters, filters.page + 1)}>Siguiente</Link>}{filters.page > pages && <BackLink href={supportHref(path, filters, 1)}>Volver al inicio</BackLink>}</div></nav>;
}
export function SupportBadge({ label, warning = false }: { label: string; warning?: boolean }) { return <span className={`${styles.badge} ${warning ? styles.blocked : styles.inactive}`}>{label}</span>; }
export function PrivateSupportNotice() { return <p className={styles.muted}>Información privada — usar sólo para soporte.</p>; }

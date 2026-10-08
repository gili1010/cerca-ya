import Link from "next/link";
import { readAdminPhase2 } from "@/lib/admin/server";
import type { AdminPage, AdminParams } from "@/lib/admin/types";
import { parseSupportFilters, shortOrderId, orderStatusLabels, type AdminOrder } from "@/lib/admin/phase2-types";
import { AdminEmpty, AdminHeading, adminDate } from "@/components/admin/admin-common";
import { SupportBadge, SupportFiltersForm, SupportPagination } from "@/components/admin/support-common";
import { money } from "@/lib/products";
import styles from "@/components/admin/admin.module.css";
export default async function OrdersPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const filters = parseSupportFilters(await searchParams, "orders");
  const data = await readAdminPhase2<AdminPage<AdminOrder>>("orders", "/admin/pedidos", filters);
  return <><AdminHeading title="Pedidos" description="Consulta para soporte. No se modifica el historial comercial." /><SupportFiltersForm section="orders" filters={filters} /><section className={styles.panel}>{data.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Pedidos"><table className={styles.table}><thead><tr><th scope="col">Pedido</th><th scope="col">Fecha</th><th scope="col">Comprador</th><th scope="col">Comercio</th><th scope="col">Productos</th><th scope="col">Total</th><th scope="col">Modalidad</th><th scope="col">Estado</th></tr></thead><tbody>{data.rows.map(r => <tr key={r.id}><td><Link href={`/admin/pedidos/${r.id}`}>#{shortOrderId(r.id)}</Link></td><td>{adminDate(r.created_at)}</td><td><Link href={`/admin/usuarios/${r.buyer_id}`}>{r.buyer_name || "Sin nombre"}</Link></td><td><Link href={`/admin/comercios/${r.business_id}`}>{r.business_name}</Link></td><td>{r.item_count}</td><td>{money(r.total)}</td><td>{r.delivery_type === "DELIVERY" ? "Envío" : "Retiro"}</td><td><SupportBadge label={orderStatusLabels[r.status]} /></td></tr>)}</tbody></table></div> : <AdminEmpty />}</section><SupportPagination path="/admin/pedidos" filters={filters} total={data.total} /></>;
}

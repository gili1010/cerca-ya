import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readAdminPhase2, requireAdmin } from "@/lib/admin/server";
import type { AdminPage } from "@/lib/admin/types";
import { validAdminId, shortOrderId, orderStatusLabels, type AdminUser } from "@/lib/admin/phase2-types";
import { AdminHeading, adminDate } from "@/components/admin/admin-common";
import { PrivateSupportNotice, SupportBadge } from "@/components/admin/support-common";
import { AdminStatusAction } from "@/components/admin/admin-status-action";
import { money } from "@/lib/products";
import styles from "@/components/admin/admin.module.css";
export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/admin/usuarios");
  const { id } = await params;
  if (!validAdminId(id)) notFound();
  const data = await readAdminPhase2<AdminPage<AdminUser>>("user", `/admin/usuarios/${id}`, undefined, id);
  const u = data.rows[0]; if (!u) notFound();
  return <><BackLink href="/admin/usuarios">Usuarios</BackLink><AdminHeading title={u.name || "Usuario sin nombre"} description="Cuenta e historial operativo." /><SupportBadge label={u.suspended_at ? "Suspendido" : "Activo"} warning={Boolean(u.suspended_at)} /><section className={`${styles.panel} ${styles.detail}`}><PrivateSupportNotice /><dl className={styles.facts}><div><dt>Email</dt><dd>{u.email || "Sin informar"}</dd></div><div><dt>Teléfono</dt><dd>{u.phone || "Sin informar"}</dd></div><div><dt>Registro</dt><dd>{adminDate(u.created_at)}</dd></div><div><dt>Pedidos totales</dt><dd>{u.order_count}</dd></div>{u.suspended_at && <div><dt>Suspendido desde</dt><dd>{adminDate(u.suspended_at)}</dd></div>}<div><dt>Comercio asociado</dt><dd>{u.businesses.length ? u.businesses.map(b => <div key={b.id}><Link href={`/admin/comercios/${b.id}`}>{b.name}</Link></div>) : "Sin comercio"}</dd></div></dl></section>{u.is_admin ? <p className={styles.muted}>Cuenta administradora protegida: no se puede suspender desde este panel.</p> : <AdminStatusAction entity="user" id={u.id} name={u.name || "Usuario"} blocked={Boolean(u.suspended_at)} />}<h2>Pedidos recientes</h2><p className={styles.muted}>Últimos 10 pedidos. <Link href={`/admin/pedidos?comprador=${u.id}`}>Ver todos los pedidos</Link></p><section className={styles.panel}>{u.recent_orders.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Pedidos recientes"><table className={styles.table}><thead><tr><th scope="col">Pedido</th><th scope="col">Fecha</th><th scope="col">Comercio</th><th scope="col">Estado</th><th scope="col">Total</th></tr></thead><tbody>{u.recent_orders.map(r => <tr key={r.id}><td><Link href={`/admin/pedidos/${r.id}`}>#{shortOrderId(r.id)}</Link></td><td>{adminDate(r.created_at)}</td><td>{r.business_name}</td><td>{orderStatusLabels[r.status]}</td><td>{money(r.total)}</td></tr>)}</tbody></table></div> : <p className={styles.empty}>Este usuario todavía no tiene pedidos.</p>}</section></>;
}

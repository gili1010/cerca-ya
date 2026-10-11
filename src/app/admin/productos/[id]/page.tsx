import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readAdminPhase2, requireAdmin } from "@/lib/admin/server";
import type { AdminPage, AdminProduct } from "@/lib/admin/types";
import { validAdminId } from "@/lib/admin/phase2-types";
import { AdminBadge, AdminHeading, adminDate } from "@/components/admin/admin-common";
import { AdminStatusAction } from "@/components/admin/admin-status-action";
import { money } from "@/lib/products";
import styles from "@/components/admin/admin.module.css";
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/admin/productos"); const { id } = await params; if (!validAdminId(id)) notFound();
  const data = await readAdminPhase2<AdminPage<AdminProduct>>("product", `/admin/productos/${id}`, undefined, id);
  const p = data.rows[0]; if (!p) notFound();
  return <><BackLink href="/admin/productos">Productos</BackLink><AdminHeading title={p.name} description="Revisión del recurso denunciado." /><AdminBadge active={p.active} blocked={Boolean(p.admin_blocked_at)} /><section className={`${styles.panel} ${styles.detail}`}><dl className={styles.facts}><div><dt>Comercio</dt><dd><Link href={`/admin/comercios/${p.business_id}`}>{p.business_name}</Link></dd></div><div><dt>Categoría</dt><dd>{p.category_name}</dd></div><div><dt>Precio</dt><dd>{money(p.price)}</dd></div><div><dt>Modalidad</dt><dd>{p.inventory_mode === "ON_DEMAND" ? "A pedido" : "Con stock"}</dd></div><div><dt>Alta</dt><dd>{adminDate(p.created_at)}</dd></div></dl>{!p.business_active && <p className={styles.muted}>Comercio inactivo: el producto no es visible públicamente.</p>}</section><AdminStatusAction entity="product" id={p.id} name={p.name} blocked={Boolean(p.admin_blocked_at)} /></>;
}

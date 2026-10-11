import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readAdminPhase2, requireAdmin } from "@/lib/admin/server";
import type { AdminPage } from "@/lib/admin/types";
import { validAdminId, shortOrderId, orderStatusLabels, type AdminOrder } from "@/lib/admin/phase2-types";
import { AdminHeading, adminDate } from "@/components/admin/admin-common";
import { CopyOrderId } from "@/components/admin/copy-order-id";
import { PrivateSupportNotice, SupportBadge } from "@/components/admin/support-common";
import { ProductImage } from "@/components/details/product-image";
import { placeholderImage, validImageUrl } from "@/lib/public-catalog";
import { money } from "@/lib/products";
import styles from "@/components/admin/admin.module.css";
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/admin/pedidos"); const { id } = await params; if (!validAdminId(id)) notFound();
  const data = await readAdminPhase2<AdminPage<AdminOrder>>("order", `/admin/pedidos/${id}`, undefined, id);
  const r = data.rows[0]; if (!r) notFound();
  const x = r.checkout;
  const timeline = [["Creación", r.created_at], ["Confirmación", r.confirmed_at], ["Listo", r.ready_at], ["Completado", r.completed_at], ["Cancelado", r.cancelled_at], ["Vencimiento de confirmación", r.expires_at]] as const;
  return <><BackLink href="/admin/pedidos">Pedidos</BackLink><AdminHeading title={`Pedido #${shortOrderId(r.id)}`} description="Detalle histórico · sólo consulta." /><SupportBadge label={orderStatusLabels[r.status]} /><CopyOrderId id={r.id} /><section className={`${styles.panel} ${styles.detail}`}><dl className={styles.facts}><div><dt>Comprador</dt><dd><Link href={`/admin/usuarios/${r.buyer_id}`}>{r.buyer_name || "Sin nombre"}</Link></dd></div><div><dt>Comercio</dt><dd><Link href={`/admin/comercios/${r.business_id}`}>{r.business_name}</Link></dd></div><div><dt>Entrega</dt><dd>{r.delivery_type === "DELIVERY" ? "Envío" : "Retiro"}</dd></div><div><dt>Método de pago</dt><dd>{x ? { CASH: "Efectivo", TRANSFER: "Transferencia", ARRANGE: "A coordinar" }[x.payment_method] : "Sin registro"}</dd></div><div><dt>Total</dt><dd><strong>{money(r.total)}</strong></dd></div></dl></section><h2>Productos</h2><section className={styles.panel}><div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Productos del pedido"><table className={styles.table}><thead><tr><th scope="col">Producto (snapshot)</th><th scope="col">Cantidad</th><th scope="col">Precio unitario</th><th scope="col">Subtotal</th></tr></thead><tbody>{r.items.map((i, index) => <tr key={index}><td><div className={styles.productName}><ProductImage className={styles.photo} src={i.image_url && validImageUrl(i.image_url) ? i.image_url : placeholderImage} alt={i.name} />{i.name}</div></td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{money(i.subtotal)}</td></tr>)}</tbody></table></div></section><p className={styles.muted}>Nombres y precios históricos. Las fotos corresponden a las imágenes disponibles actualmente.</p><section className={`${styles.panel} ${styles.detail}`}><h2>Contacto y entrega</h2><PrivateSupportNotice />{x ? <dl className={styles.facts}>{[["Nombre", x.customer_name], ["Teléfono", x.customer_phone], ["Dirección", r.delivery_type === "DELIVERY" ? x.delivery_address : x.pickup_address], ["Localidad", r.delivery_type === "DELIVERY" ? x.delivery_city : x.pickup_city], ["Referencia", x.delivery_reference]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "Sin informar"}</dd></div>)}</dl> : <p>Este pedido no tiene datos de contacto guardados.</p>}</section><section className={`${styles.panel} ${styles.detail}`}><h2>Timeline</h2><dl className={styles.facts}>{timeline.map(([label, date]) => <div key={label}><dt>{label}</dt><dd>{date ? adminDate(date) : "Sin registrar"}</dd></div>)}</dl></section></>;
}

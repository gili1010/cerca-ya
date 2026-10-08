import Link from "next/link";
import { readAdmin } from "@/lib/admin/server";
import { parseAdminFilters, type AdminProduct, type AdminPage, type AdminParams } from "@/lib/admin/types";
import { AdminBadge, AdminEmpty, AdminFiltersForm, AdminHeading, AdminPagination, adminDate } from "@/components/admin/admin-common";
import { AdminStatusAction } from "@/components/admin/admin-status-action";
import { ProductImage } from "@/components/details/product-image";
import { placeholderImage, validImageUrl } from "@/lib/public-catalog";
import styles from "@/components/admin/admin.module.css";

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<AdminParams> }) {
  const filters = parseAdminFilters(await searchParams);
  const data = await readAdmin<AdminPage<AdminProduct>>("products", "/admin/productos", filters);
  return <><AdminHeading title="Productos" description="Bloqueá contenido sin alterar el inventario ni los pedidos." /><AdminFiltersForm products filters={filters} /><section className={styles.panel}>{data.rows.length ? <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Listado de productos"><table className={styles.table}><thead><tr><th scope="col">Producto</th><th scope="col">Comercio</th><th scope="col">Categoría</th><th scope="col">Precio</th><th scope="col">Modalidad</th><th scope="col">Estado</th><th scope="col">Alta</th><th scope="col">Acciones</th></tr></thead><tbody>{data.rows.map(p => <tr key={p.id}><td><div className={styles.productName}><ProductImage className={styles.photo} src={p.image_url && validImageUrl(p.image_url) ? p.image_url : placeholderImage} alt={`Foto de ${p.name}`} /><strong>{p.name}</strong></div></td><td><Link href={`/admin/comercios/${p.business_id}`}>{p.business_name}</Link>{!p.business_active && <small>Comercio inactivo: no visible públicamente</small>}</td><td>{p.category_name}</td><td>{currency.format(p.price)}</td><td>{p.inventory_mode === "ON_DEMAND" ? "A pedido" : "Con stock"}</td><td><AdminBadge active={p.active} blocked={Boolean(p.admin_blocked_at)} /></td><td>{adminDate(p.created_at)}</td><td><AdminStatusAction entity="product" id={p.id} name={p.name} blocked={Boolean(p.admin_blocked_at)} /></td></tr>)}</tbody></table></div> : <AdminEmpty />}</section><AdminPagination path="/admin/productos" filters={filters} total={data.total} /></>;
}

"use client";

import Link from "next/link";
import { BadgeCheck, Info, Package, Pencil, Plus, Store, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BusinessRow, Database, StockStatus } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMerchantProducts, productPageSize } from "@/lib/merchant-products/client";
import { productErrorMessage } from "@/lib/merchant-products/form";
import { placeholderImage, validImageUrl } from "@/lib/public-catalog";
import { ProductImage } from "../details/product-image";
import { FormError } from "../requests/request-common";
import { MerchantBusinessGate } from "./business-gate";
import { StockConfirmation } from "./stock-confirmation";
import styles from "./product-list.module.css";

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
const stockLabels: Record<StockStatus, string> = { IN_STOCK: "En stock", OUT_OF_STOCK: "Sin stock", LOW_STOCK: "Stock bajo", UNCONFIRMED: "Sin confirmar" };
type ProductAction = Database["public"]["Functions"]["manage_my_product"]["Args"]["p_action"];

export function MerchantProductList() {
  return <MerchantBusinessGate>{business => <BusinessProducts key={business.id} business={business} />}</MerchantBusinessGate>;
}

function BusinessProducts({ business }: { business: BusinessRow }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMerchantProducts>> | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState<{ id: string; action: ProductAction } | null>(null);
  const inFlight = useRef(false);
  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos cargar tus productos. Volvé a intentar en unos momentos."); return; }
    getMerchantProducts(client, business.id, page).then(result => {
      if (live) { setData(result); setError(""); }
    }).catch(() => { if (live) setError("No pudimos cargar tus productos. Volvé a intentar."); });
    return () => { live = false; };
  }, [business.id, page, attempt]);

  async function manage(id: string, action: ProductAction) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy({ id, action }); setActionError(""); setNotice("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { data: updated, error: failure } = await client.rpc("manage_my_product", { p_product_id: id, p_action: action });
      if (failure) throw failure;
      setData(current => current ? { ...current, products: current.products.map(product => product.id === id ? updated : product) } : current);
      setNotice(action === "confirm_stock" ? updated.inventory_mode === "ON_DEMAND" ? "Disponibilidad confirmada." : "Stock confirmado. La cantidad se mantuvo." : action === "activate" ? "Producto reactivado." : "Producto desactivado. Podés reactivarlo cuando quieras.");
    } catch (cause) { setActionError(productErrorMessage(cause)); }
    finally { inFlight.current = false; setBusy(null); }
  }

  function changePage(next: number) { setData(null); setError(""); setNotice(""); setActionError(""); setPage(next); }
  return <>
    <div className={`workflow-heading with-action ${styles.header}`}><div><span className="eyebrow">{business.name}</span><h1>Mis productos</h1><p>Administrá tu catálogo y mantené la disponibilidad al día.</p></div><Link className="primary-button" href="/comercio/productos/nuevo"><Plus size={18} aria-hidden="true" />Publicar producto</Link></div>
    <p className={styles.hint}><Info size={16} aria-hidden="true" />Podés desactivar productos sin borrarlos y reactivarlos cuando quieras.</p>
    <FormError message={error} />{error && <button className="outline-button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Reintentar</button>}
    {!data && !error && <p className="workflow-loading" role="status">Cargando tus productos…</p>}
    <FormError message={actionError} />{notice && <p className="info-note" role="status">{notice}</p>}
    {data && !error && (data.total === 0 ? <section className="empty-state"><h2>Tu comercio todavía no tiene productos.</h2><Link className="primary-button" href="/comercio/productos/nuevo">Publicar primer producto</Link></section> : <>
      <div className={styles.catalogHeading}><span className={styles.count}><Package size={16} aria-hidden="true" />{data.total} {data.total === 1 ? "producto" : "productos"}</span></div>
      <div className={styles.grid}>{data.products.map(product => {
        const imageUrl = data.imageUrls[product.id];
        const onDemand = product.inventory_mode === "ON_DEMAND";
        const unavailable = onDemand ? !product.available_today : product.stock_status === "OUT_OF_STOCK" || product.stock_quantity === 0;
        return <article className={`panel ${styles.card}`} key={product.id}>
          <div className={styles.overview}>
            <div className={styles.photo}><ProductImage src={imageUrl && validImageUrl(imageUrl) ? imageUrl : placeholderImage} alt={`Foto de ${product.name}`} className={styles.image} /></div>
            <div className={styles.summary}>
              <div className={styles.titleRow}><h2 className={styles.name} title={product.name}>{product.name}</h2><span className={`${styles.status} ${product.active ? styles.active : styles.inactive}`}>{product.active ? "Activo" : "Inactivo"}</span></div>
              <p className={styles.price}>{currency.format(product.price)}</p>
              <p className={styles.category}>{data.categories.find(category => category.id === product.category_id)?.name ?? "Categoría no disponible"}</p>
            </div>
          </div>
          <div className={styles.inventory}>
            <span className={styles.mode}>{onDemand ? "A pedido" : "Con stock"}</span>
            <span className={`${styles.availability} ${unavailable ? styles.unavailable : styles.available}`}>
              {onDemand ? product.available_today ? "Disponible hoy" : "No disponible hoy" : <>Stock: {product.stock_quantity} unidades <span className={styles.stockState}>· {stockLabels[product.stock_status]}</span></>}
            </span>
          </div>
          {product.admin_blocked_at && <p className="info-note">Este producto fue desactivado por administración.</p>}
          <div className={styles.delivery}><span><Store size={14} aria-hidden="true" />{product.pickup_enabled ? "Retiro" : "Sin retiro"}</span><span><Truck size={14} aria-hidden="true" />{product.delivery_enabled ? "Envío" : "Sin envío"}</span></div>
          <StockConfirmation compact date={onDemand ? product.availability_confirmed_at : product.stock_confirmed_at} label={onDemand ? "Disponibilidad" : "Stock"} />
          <div className={styles.actions}>
            <div className={styles.primaryActions}><Link className="outline-button" href={`/comercio/productos/${product.id}/editar`} aria-disabled={Boolean(busy)} onClick={event => { if (busy) event.preventDefault(); }}><Pencil size={15} aria-hidden="true" />Editar</Link><button className="primary-button" disabled={Boolean(busy)} onClick={() => void manage(product.id, "confirm_stock")}><BadgeCheck size={16} aria-hidden="true" />{busy?.id === product.id && busy.action === "confirm_stock" ? "Confirmando..." : product.inventory_mode === "ON_DEMAND" ? "Confirmar disponibilidad" : "Confirmar stock"}</button></div>
            <button className={styles.toggle} disabled={Boolean(busy) || Boolean(product.admin_blocked_at)} onClick={() => void manage(product.id, product.active ? "deactivate" : "activate")}>{busy?.id === product.id && busy.action !== "confirm_stock" ? "Guardando..." : product.admin_blocked_at ? "Desactivado por administración" : product.active ? "Desactivar producto" : "Reactivar producto"}</button>
          </div>
        </article>;
      })}</div>
      {data.total > productPageSize && <nav className="merchant-product-pagination" aria-label="Páginas de productos"><button className="outline-button" disabled={page === 0 || Boolean(busy)} onClick={() => changePage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(data.total / productPageSize)}</span><button className="outline-button" disabled={(page + 1) * productPageSize >= data.total || Boolean(busy)} onClick={() => changePage(page + 1)}>Siguiente</button></nav>}
    </>)}
  </>;
}

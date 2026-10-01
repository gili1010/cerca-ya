"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { BusinessRow, Database, StockStatus } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMerchantProducts, productPageSize } from "@/lib/merchant-products/client";
import { productErrorMessage } from "@/lib/merchant-products/form";
import { FormError } from "../requests/request-common";
import { MerchantBusinessGate } from "./business-gate";
import { StockConfirmation } from "./stock-confirmation";

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
      setNotice(action === "confirm_stock" ? "Stock confirmado. La cantidad se mantuvo." : action === "activate" ? "Producto reactivado." : "Producto desactivado. Podés reactivarlo cuando quieras.");
    } catch (cause) { setActionError(productErrorMessage(cause)); }
    finally { inFlight.current = false; setBusy(null); }
  }

  function changePage(next: number) { setData(null); setError(""); setNotice(""); setActionError(""); setPage(next); }
  return <>
    <div className="workflow-heading with-action"><div><span className="eyebrow">{business.name}</span><h1>Mis productos</h1><p>Administrá tu stock y mantené actualizada su confirmación.</p></div><Link className="primary-button" href="/comercio/productos/nuevo">Publicar producto</Link></div>
    <p className="info-note">Los productos activos de tu comercio activo aparecen en la búsqueda. Con stock, también pueden aparecer en Disponible hoy.</p>
    <FormError message={error} />{error && <button className="outline-button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Reintentar</button>}
    {!data && !error && <p className="workflow-loading" role="status">Cargando tus productos…</p>}
    <FormError message={actionError} />{notice && <p className="info-note" role="status">{notice}</p>}
    {data && !error && (data.total === 0 ? <section className="empty-state"><h2>Tu comercio todavía no tiene productos.</h2><Link className="primary-button" href="/comercio/productos/nuevo">Publicar primer producto</Link></section> : <>
      <p className="merchant-product-total">{data.total} productos · incluye activos e inactivos</p>
      <div className="merchant-product-grid">{data.products.map(product => <article className="panel merchant-product-card" key={product.id}>
        <div className="merchant-product-top"><span className="merchant-product-placeholder" aria-label="Producto sin foto"><Package size={28} aria-hidden="true" /></span><div><span className={`reservation-status ${product.active ? "status-confirmed" : "status-cancelled"}`}>{product.active ? "Activo" : "Inactivo"}</span><h2>{product.name}</h2></div></div>
        <p className="merchant-product-price">{currency.format(product.price)}</p>
        <dl className="request-facts"><div><dt>Categoría</dt><dd>{data.categories.find(category => category.id === product.category_id)?.name ?? "Categoría no disponible"}</dd></div><div><dt>Stock</dt><dd>{product.stock_quantity} unidades · {stockLabels[product.stock_status]}</dd></div><div><dt>Retiro</dt><dd>{product.pickup_enabled ? "Disponible" : "No disponible"}</dd></div><div><dt>Envío</dt><dd>{product.delivery_enabled ? "Disponible" : "No disponible"}</dd></div></dl>
        <StockConfirmation date={product.stock_confirmed_at} />
        <div className="merchant-product-actions"><Link className="outline-button" href={`/comercio/productos/${product.id}/editar`} aria-disabled={Boolean(busy)} onClick={event => { if (busy) event.preventDefault(); }}>Editar</Link><button className="primary-button" disabled={Boolean(busy)} onClick={() => void manage(product.id, "confirm_stock")}>{busy?.id === product.id && busy.action === "confirm_stock" ? "Confirmando..." : "Confirmar stock"}</button><button className="secondary-link" disabled={Boolean(busy)} onClick={() => void manage(product.id, product.active ? "deactivate" : "activate")}>{busy?.id === product.id && busy.action !== "confirm_stock" ? "Guardando..." : product.active ? "Desactivar producto" : "Reactivar producto"}</button></div>
      </article>)}</div>
      {data.total > productPageSize && <nav className="merchant-product-pagination" aria-label="Páginas de productos"><button className="outline-button" disabled={page === 0 || Boolean(busy)} onClick={() => changePage(page - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(data.total / productPageSize)}</span><button className="outline-button" disabled={(page + 1) * productPageSize >= data.total || Boolean(busy)} onClick={() => changePage(page + 1)}>Siguiente</button></nav>}
    </>)}
  </>;
}

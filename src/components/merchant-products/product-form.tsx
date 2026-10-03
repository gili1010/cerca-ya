"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { BusinessRow, CategoryRow, ProductRow } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getMerchantProductForm } from "@/lib/merchant-products/client";
import { normalizeProduct, productErrorMessage, productFormValues, validateProduct } from "@/lib/merchant-products/form";
import { FormError } from "../requests/request-common";
import { MerchantBusinessGate } from "./business-gate";
import { StockConfirmation } from "./stock-confirmation";
import { ProductPhotoInput } from "./product-photo-input";
import { cleanupProductPhotos, saveProductPhoto, type MainPhoto, type PhotoChange } from "@/lib/merchant-products/photo-storage";

export function MerchantProductForm({ productId }: { productId?: string }) {
  return <MerchantBusinessGate>{business => <ProductFormLoader key={`${business.id}-${productId ?? "new"}`} business={business} productId={productId} />}</MerchantBusinessGate>;
}

function ProductFormLoader({ business, productId }: { business: BusinessRow; productId?: string }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMerchantProductForm>> | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos cargar los datos. Volvé a intentar en unos momentos."); return; }
    getMerchantProductForm(client, business.id, productId).then(result => {
      if (live) { setData(result); setError(""); }
    }).catch(() => { if (live) setError("No pudimos cargar el producto y sus categorías. Volvé a intentar."); });
    return () => { live = false; };
  }, [business.id, productId, attempt]);
  if (error) return <section className="panel"><FormError message={error} /><button className="outline-button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Reintentar</button></section>;
  if (!data) return <p className="workflow-loading" role="status">Cargando formulario…</p>;
  if (productId && !data.product) return <section className="empty-state"><h1>Producto no disponible</h1><p>No encontramos ese producto en tu comercio.</p><Link className="primary-button" href="/comercio/productos">Volver a Mis productos</Link></section>;
  return <ProductFormFields business={business} product={data.product} initialImage={data.image} categories={data.categories} preferredCategoryIds={data.categoryIds} />;
}

function ProductFormFields({ business, product, initialImage, categories, preferredCategoryIds }: {
  business: BusinessRow; product: ProductRow | null; initialImage: MainPhoto | null; categories: CategoryRow[]; preferredCategoryIds: string[];
}) {
  const router = useRouter();
  const [form, setForm] = useState(() => ({
    ...productFormValues(product),
    pickup_enabled: product?.pickup_enabled ?? business.pickup_enabled,
    delivery_enabled: product?.delivery_enabled ?? business.delivery_enabled,
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [phase, setPhase] = useState("");
  const [savedId, setSavedId] = useState<string | null>(product?.id ?? null);
  const savedIdRef = useRef<string | null>(product?.id ?? null);
  const [photo, setPhoto] = useState<MainPhoto | null>(initialImage);
  const [photoChange, setPhotoChange] = useState<PhotoChange>({ kind: "keep" });
  const [cleanupPaths, setCleanupPaths] = useState<string[]>([]);
  const [notice, setNotice] = useState("");
  const inFlight = useRef(false);
  const preferred = categories.filter(category => preferredCategoryIds.includes(category.id));
  const other = categories.filter(category => !preferredCategoryIds.includes(category.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || processing) return;
    const validation = validateProduct(form, categories.map(category => category.id));
    if (validation) { setError(validation); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    setPhase(savedIdRef.current ? "Guardando cambios..." : "Publicando producto...");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { data: productId, error: failure } = await client.rpc("save_my_product", {
        p_input: normalizeProduct(form), p_product_id: savedIdRef.current,
      });
      if (failure) throw failure;
      savedIdRef.current = productId; setSavedId(productId);
      let pending = await cleanupProductPhotos(client, business.id, productId, cleanupPaths);
      if (photoChange.kind !== "keep") {
        setPhase(photoChange.kind === "upload" ? "Subiendo imagen..." : "Eliminando foto...");
        const result = await saveProductPhoto(client, business.id, productId, photo?.url ?? null, photoChange);
        pending = [...new Set([...pending, ...result.pendingCleanup])]; setCleanupPaths(pending);
        setPhoto(result.url ? { url: result.url } : null);
        if (!result.success) {
          setNotice(product ? "Los cambios del producto se guardaron, pero no pudimos guardar la foto." : "El producto fue creado, pero no pudimos cargar la imagen.");
          setError(result.message); return;
        }
        setPhotoChange({ kind: "keep" });
      }
      setCleanupPaths(pending);
      if (pending.length) { setNotice("El producto y la foto se guardaron. Queda pendiente eliminar un archivo anterior; reintentá la limpieza antes de salir."); return; }
      router.replace("/comercio/productos");
      router.refresh();
    } catch (cause) {
      setError(productErrorMessage(cause));
    } finally { inFlight.current = false; setBusy(false); setPhase(""); }
  }

  async function retryCleanup() {
    if (inFlight.current || !savedId) return;
    inFlight.current = true; setBusy(true); setPhase("Eliminando archivos anteriores...");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) return;
      const pending = await cleanupProductPhotos(client, business.id, savedId, cleanupPaths);
      setCleanupPaths(pending);
      setNotice(pending.length ? "No pudimos completar la limpieza. Revisá la conexión y volvé a intentar." : "Limpieza completada.");
    } finally { inFlight.current = false; setBusy(false); setPhase(""); }
  }

  return <div className="workflow-narrow"><Link className="secondary-link" href="/comercio/productos">Volver a Mis productos</Link>
    <div className="workflow-heading"><span className="eyebrow">{business.name}</span><h1>{product ? "Editar producto" : "Publicar producto"}</h1><p>Precio, disponibilidad y stock de tu comercio.</p></div>
    <form className="panel workflow-form" onSubmit={submit} aria-busy={busy}>
      <label>Nombre<input required maxLength={160} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} disabled={busy} /></label>
      <label>Descripción<textarea maxLength={5000} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} disabled={busy} /></label>
      <label>Categoría<select required value={form.category_id} onChange={event => setForm({ ...form, category_id: event.target.value })} disabled={busy || !categories.length}>
        <option value="">Seleccioná una categoría</option>
        {preferred.length > 0 && <optgroup label="Categorías de tu comercio">{preferred.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</optgroup>}
        {other.length > 0 && <optgroup label="Otras categorías">{other.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</optgroup>}
      </select><small>Podés elegir cualquier categoría del catálogo.</small></label>
      {!categories.length && <FormError message="No hay categorías disponibles en este momento. Volvé a intentar más tarde." />}
      <div className="form-columns"><label>Marca<input maxLength={160} value={form.brand ?? ""} onChange={event => setForm({ ...form, brand: event.target.value })} disabled={busy} /></label><label>Modelo<input maxLength={160} value={form.model ?? ""} onChange={event => setForm({ ...form, model: event.target.value })} disabled={busy} /></label></div>
      <label>SKU<input maxLength={100} value={form.sku ?? ""} onChange={event => setForm({ ...form, sku: event.target.value })} disabled={busy} /><small>Opcional. Debe ser único dentro de tu comercio.</small></label>
      <fieldset className="form-checkboxes" disabled={busy}><legend>¿Cómo ofrecés este producto?</legend>
        <label><input type="radio" name="inventory-mode" checked={form.inventory_mode === "STOCKED"} onChange={() => setForm({ ...form, inventory_mode: "STOCKED" })} />Tengo unidades en stock</label>
        <label><input type="radio" name="inventory-mode" checked={form.inventory_mode === "ON_DEMAND"} onChange={() => setForm({ ...form, inventory_mode: "ON_DEMAND" })} />Lo preparo / produzco a pedido</label>
      </fieldset>
      <div className="form-columns"><label>Precio (ARS)<input type="number" inputMode="decimal" required min="0" max="9999999999.99" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} disabled={busy} /></label>{form.inventory_mode === "STOCKED" ? <label>Stock<input type="number" inputMode="numeric" required min="0" max="2147483647" step="1" value={form.stock_quantity} onChange={event => setForm({ ...form, stock_quantity: event.target.value })} disabled={busy} /></label> : <label>Disponible hoy<select value={form.available_today ? "yes" : "no"} onChange={event => setForm({ ...form, available_today: event.target.value === "yes" })} disabled={busy}><option value="yes">Sí</option><option value="no">No</option></select></label>}</div>
      <p className="info-note">{form.inventory_mode === "ON_DEMAND" ? "Se prepara a pedido, sin cantidad de stock. Al guardar, confirmás si está disponible hoy." : "Al publicar o cambiar la cantidad, se confirma el stock con la hora actual. Con 0 unidades, el producto queda sin stock."}</p>
      {product && form.inventory_mode === "STOCKED" && <StockConfirmation date={product.stock_confirmed_at} />}
      <fieldset className="form-checkboxes" disabled={busy}><legend>Opciones de entrega</legend><label><input type="checkbox" checked={form.pickup_enabled} onChange={event => setForm({ ...form, pickup_enabled: event.target.checked })} />Permite retiro</label><label><input type="checkbox" checked={form.delivery_enabled} onChange={event => setForm({ ...form, delivery_enabled: event.target.checked })} />Permite envío</label></fieldset>
      {product && <label className="checkbox-label"><input type="checkbox" checked={form.active} onChange={event => setForm({ ...form, active: event.target.checked })} disabled={busy} />Producto activo</label>}
      <ProductPhotoInput initialImage={photo} change={photoChange} onChange={setPhotoChange} busy={busy} processing={processing} onProcessing={setProcessing} />
      {notice && <p className="info-note" role="status">{notice}</p>}
      {savedId && notice && <Link className="secondary-link" href={`/comercio/productos/${savedId}/editar`}>Abrir Editar producto</Link>}
      {cleanupPaths.length > 0 && <div><p className="info-note">Hay archivos sin usar pendientes de limpieza.</p><button type="button" className="outline-button" disabled={busy || processing} onClick={() => void retryCleanup()}>Reintentar limpieza</button></div>}
      {phase && <p role="status">{phase}</p>}
      <FormError message={error} /><button className="primary-button" type="submit" disabled={busy || processing || !categories.length}>{processing ? "Procesando imagen..." : busy ? phase : savedId ? "Guardar cambios" : "Publicar producto"}</button>
    </form>
  </div>;
}

"use client";
import { BackLink } from "@/components/navigation/back-link";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Minus, PackageOpen, Plus, ShoppingBag, Store, Trash2, Truck } from "lucide-react";
import { money, type Product } from "@/lib/products";
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import { ProductImage } from "@/components/details/product-image";
import { useCart } from "./cart-provider";
import { useCartCatalog } from "./use-cart-catalog";
import styles from "./cart.module.css";

type Cart = ReturnType<typeof useCart>["carts"][number];

function itemCount(cart: Cart) {
  return cart.items.reduce((total, item) => total + item.quantity, 0);
}

export function CartIndexView() {
  const { carts, ready, storageWarning } = useCart();
  if (!ready) return <div className="panel" role="status">Cargando tus pedidos...</div>;

  return <div className={styles.page}>
    <BackLink href="/">Seguir explorando</BackLink>
    <header className={styles.pageHeading}>
      <span className="eyebrow"><ShoppingBag size={16} aria-hidden="true" />A UN PASO DE PEDIR</span>
      <h1>Tus pedidos en preparación</h1>
      <p>Elegí un comercio para revisar los productos y completar tu pedido.</p>
    </header>
    {storageWarning && <p className="workflow-warning" role="status">{storageWarning}</p>}
    {carts.length ? <div className={styles.cartList}>
      {carts.map(cart => <Link key={cart.businessId} className={styles.cartLink} href={`/carrito/${encodeURIComponent(cart.businessId)}`}>
        <span className={styles.storeIcon}><Store size={24} aria-hidden="true" /></span>
        <div className={styles.cartLinkBody}>
          <h2>{cart.businessName}</h2>
          <p>{itemCount(cart)} {itemCount(cart) === 1 ? "unidad" : "unidades"} · {cart.items.length} {cart.items.length === 1 ? "producto" : "productos"}</p>
          <span>{cart.attempt ? "Continuar con el pedido en proceso" : "Revisar y continuar"}</span>
        </div>
        <ArrowRight size={20} aria-hidden="true" />
      </Link>)}
    </div> : <section className={`panel ${styles.empty}`}>
      <ShoppingBag size={36} aria-hidden="true" />
      <h2>Tu próximo pedido empieza cerca</h2>
      <p>Agregá productos de una tienda. Cada comercio tiene su propio pedido.</p>
      <Link className="primary-button" href="/">Explorar productos</Link>
    </section>}
  </div>;
}

export function CartView({ businessId }: { businessId: string }) {
  const { cartFor, ready, storageWarning, addProduct, setQuantity, removeItem, setDeliveryType } = useCart();
  const catalog = useCartCatalog(businessId);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const cart = cartFor(businessId);

  if (!ready) return <div className="panel" role="status">Cargando tu pedido...</div>;
  if (!cart) return <div className={styles.page}>
    <BackLink href="/carrito">Tus pedidos en preparación</BackLink>
    <section className={`panel ${styles.empty}`}>
      <PackageOpen size={36} aria-hidden="true" />
      <h1>Este pedido todavía está vacío</h1>
      <p>Elegí los productos de una tienda para armar tu pedido.</p>
      <Link className="primary-button" href={catalog.business?.slug ? `/tienda/${encodeURIComponent(catalog.business.slug)}` : "/"}>Seguir comprando</Link>
    </section>
  </div>;

  const business = catalog.business;
  const frozen = Boolean(cart.attempt);
  const byId = new Map(catalog.products.map(product => [product.id, product]));
  const entries = cart.items.map(item => ({ item, product: byId.get(item.productId) }));
  const loaded = !catalog.loading && !catalog.error && Boolean(business?.active);
  const allProducts = entries.every(({ product }) => product && product.storeId === businessId);
  const estimatesReady = loaded && allProducts;
  const subtotal = entries.reduce((total, { item, product }) => total + (product?.price ?? 0) * item.quantity, 0);
  const allAvailable = entries.every(({ item, product }) => product && isProductAvailable(product) && (isOnDemand(product) || product.stock >= item.quantity));
  const pickup = loaded && business?.pickup_enabled && allProducts && entries.every(({ product }) => product?.pickupToday);
  const delivery = loaded && business?.delivery_enabled && allProducts && entries.every(({ product }) => product?.deliveryToday);
  const validDelivery = cart.deliveryType === "pickup" ? pickup : delivery;
  const shipping = cart.deliveryType === "delivery" ? business?.delivery_price ?? 0 : 0;
  const minimum = business?.minimum_order ?? 0;
  const remaining = Math.max(0, minimum - subtotal);
  const canContinue = frozen || Boolean(estimatesReady && allAvailable && validDelivery && remaining === 0);
  const storeSlug = business?.slug || cart.businessSlug;
  const storeHref = storeSlug ? `/tienda/${encodeURIComponent(storeSlug)}` : "/";
  const suggestions = loaded && !frozen ? catalog.products.filter(product => product.storeId === businessId && isProductAvailable(product) && (product.pickupToday || product.deliveryToday) && !cart.items.some(item => item.productId === product.id)).slice(0, 4) : [];

  function report(result: string | null, success = "") {
    setNoticeError(Boolean(result));
    setNotice(result ?? success);
  }

  function availabilityMessage(product: Product | undefined, quantity: number) {
    if (!loaded) return "";
    if (!product) return "Este producto ya no está disponible. Quitalo para continuar.";
    if (isOnDemand(product)) return isProductAvailable(product) ? "" : "Este producto no está disponible hoy. Quitalo para continuar.";
    if (product.stock <= 0) return "Este producto está sin stock. Quitalo para continuar.";
    return product.stock < quantity ? `Quedan ${product.stock} ${product.stock === 1 ? "unidad" : "unidades"}. Ajustá la cantidad para continuar.` : "";
  }

  return <div className={styles.page}>
    <BackLink href="/carrito">Tus pedidos en preparación</BackLink>
    <header className={styles.orderHeading}>
      <div><span className="eyebrow"><ShoppingBag size={16} aria-hidden="true" />TU PEDIDO</span>
        <h1>{business?.name || cart.businessName}</h1>
        <p>{itemCount(cart)} {itemCount(cart) === 1 ? "unidad" : "unidades"} en un solo pedido, al mismo comercio.</p>
      </div>
      <Link className={`outline-button ${styles.storeLink}`} href={storeHref}><Store size={17} aria-hidden="true" />Ver tienda</Link>
    </header>

    {storageWarning && <p className="workflow-warning" role="status">{storageWarning}</p>}
    {notice && <p className={noticeError ? "form-error" : "info-note"} role={noticeError ? "alert" : "status"}>{notice}</p>}
    {catalog.error && <div className="form-error" role="alert"><p>{catalog.error}</p><button className="outline-button button-sm" onClick={() => void catalog.refresh()}>Volver a cargar</button></div>}
    {!catalog.loading && !catalog.error && (!business || !business.active) && <p className="workflow-warning" role="status">Esta tienda no está disponible en este momento. Conservamos tus productos para que puedas revisarlos.</p>}
    {frozen && <p className="info-note" role="status">Hay un pedido en proceso. Continuá para verificarlo antes de modificar estos productos.</p>}

    <div className={styles.layout}>
      <div className={styles.itemsColumn}>
        <section className={styles.itemsPanel} aria-labelledby="cart-products-title" aria-busy={catalog.loading}>
          <div className={styles.sectionHeading}><h2 id="cart-products-title">Productos</h2><span>{cart.items.length}</span></div>
          <div className={styles.items}>
            {entries.map(({ item, product }) => {
              const name = product?.name || item.name;
              const onDemand = product ? isOnDemand(product) : item.inventoryMode === "ON_DEMAND";
              const message = availabilityMessage(product, item.quantity);
              const canIncrease = !frozen && loaded && product && isProductAvailable(product) && (onDemand || item.quantity < product.stock);
              return <article key={item.productId} className={styles.item}>
                <Link className={styles.itemPhoto} href={`/producto/${encodeURIComponent(item.productId)}`} tabIndex={-1} aria-hidden="true"><ProductImage src={product?.image || item.image} alt="" /></Link>
                <div className={styles.itemBody}>
                  <Link className={styles.itemName} href={`/producto/${encodeURIComponent(item.productId)}`}>{name}</Link>
                  <span className={`${styles.availability} ${message ? styles.unavailable : ""}`}>{onDemand ? "A pedido" : loaded && product ? product.stock > 0 ? "En stock" : "Sin stock" : ""}</span>
                  <p className={styles.unitPrice}>{catalog.loading ? "Actualizando precio..." : product && loaded ? `${money(product.price)} por unidad` : "Precio no disponible"}</p>
                  {message && <p className={styles.itemWarning}>{message}</p>}
                </div>
                <div className={styles.itemControls}>
                  <div className={styles.quantity} role="group" aria-label={`Cantidad de ${name}`}>
                    <button type="button" disabled={frozen || item.quantity <= 1} aria-label={`Quitar una unidad de ${name}`} onClick={() => report(setQuantity(businessId, item.productId, item.quantity - 1))}><Minus size={16} aria-hidden="true" /></button>
                    <output aria-label="Cantidad">{item.quantity}</output>
                    <button type="button" disabled={!canIncrease} aria-label={`Agregar una unidad de ${name}`} onClick={() => report(setQuantity(businessId, item.productId, item.quantity + 1))}><Plus size={16} aria-hidden="true" /></button>
                  </div>
                  <button type="button" className={styles.remove} disabled={frozen} onClick={() => report(removeItem(businessId, item.productId))} aria-label={`Eliminar ${name} del pedido`}><Trash2 size={14} aria-hidden="true" />Eliminar</button>
                </div>
                <strong className={styles.itemSubtotal}>{loaded && product ? money(product.price * item.quantity) : "—"}</strong>
              </article>;
            })}
          </div>
          <BackLink href={storeHref}>Seguir comprando en esta tienda</BackLink>
        </section>

        {suggestions.length > 0 && <section className={styles.suggestions} aria-labelledby="cart-suggestions-title">
          <div className={styles.sectionHeading}><div><h2 id="cart-suggestions-title">Completá tu pedido</h2><p>Más productos de {business?.name || cart.businessName}.</p></div></div>
          <div className={styles.suggestionsGrid}>
            {suggestions.map(product => <article key={product.id} className={styles.suggestion}>
              <Link className={styles.suggestionPhoto} href={`/producto/${encodeURIComponent(product.id)}`} tabIndex={-1} aria-hidden="true"><ProductImage src={product.image} alt="" /></Link>
              <div><Link className={styles.suggestionName} href={`/producto/${encodeURIComponent(product.id)}`}>{product.name}</Link><strong>{money(product.price)}</strong>{isOnDemand(product) && <small>A pedido</small>}</div>
              <button className={`outline-button button-sm ${styles.suggestionAdd}`} type="button" onClick={() => report(addProduct(product), `${product.name} se agregó a tu pedido.`)} aria-label={`Agregar ${product.name} al pedido`}><Plus size={15} aria-hidden="true" />Agregar</button>
            </article>)}
          </div>
        </section>}
      </div>

      <aside className={styles.summary} aria-labelledby="cart-summary-title">
        <h2 id="cart-summary-title">Resumen de tu pedido</h2>
        <fieldset className={styles.deliveryOptions} disabled={frozen || !loaded}>
          <legend>¿Cómo lo recibís?</legend>
          <label className={`${styles.deliveryOption} ${cart.deliveryType === "pickup" ? styles.selected : ""} ${!pickup ? styles.disabled : ""}`}>
            <input type="radio" name="cart-delivery" value="pickup" checked={cart.deliveryType === "pickup"} disabled={!pickup || frozen} onChange={() => report(setDeliveryType(businessId, "pickup"))} />
            <Store size={19} aria-hidden="true" /><span><strong>Retiro en el comercio</strong><small>{pickup ? "Sin costo" : "No disponible para este pedido"}</small></span>
          </label>
          <label className={`${styles.deliveryOption} ${cart.deliveryType === "delivery" ? styles.selected : ""} ${!delivery ? styles.disabled : ""}`}>
            <input type="radio" name="cart-delivery" value="delivery" checked={cart.deliveryType === "delivery"} disabled={!delivery || frozen} onChange={() => report(setDeliveryType(businessId, "delivery"))} />
            <Truck size={19} aria-hidden="true" /><span><strong>Envío del comercio</strong><small>{delivery ? business?.delivery_price ? money(business.delivery_price) : "Gratis" : "No disponible para este pedido"}</small></span>
          </label>
        </fieldset>

        {minimum > 0 && estimatesReady && <div className={`${styles.minimum} ${remaining === 0 ? styles.minimumReached : ""}`}>
          <div><span>Compra mínima</span><strong>{money(minimum)}</strong></div>
          <progress value={Math.min(subtotal, minimum)} max={minimum} aria-label="Progreso de compra mínima" />
          <p>{remaining > 0 ? `Te faltan ${money(remaining)} para alcanzar la compra mínima.` : <><Check size={14} aria-hidden="true" />Alcanzaste la compra mínima</>}</p>
        </div>}

        <dl className={styles.totals}>
          <div><dt>Subtotal</dt><dd>{estimatesReady ? money(subtotal) : "—"}</dd></div>
          <div><dt>{cart.deliveryType === "delivery" ? "Envío" : "Retiro"}</dt><dd>{estimatesReady && validDelivery ? shipping > 0 ? money(shipping) : "Gratis" : "—"}</dd></div>
          <div className={styles.total}><dt>Total estimado</dt><dd>{estimatesReady && validDelivery ? money(subtotal + shipping) : "—"}</dd></div>
        </dl>
        <p className={styles.totalNote}>El total se confirma al continuar. {cart.deliveryType === "delivery" && "El envío se cobra una sola vez."}</p>
        {!frozen && loaded && (!allAvailable || !allProducts) && <p className={styles.checkoutWarning}>Revisá los productos marcados antes de continuar.</p>}
        {!frozen && estimatesReady && allAvailable && !validDelivery && <p className={styles.checkoutWarning}>Elegí una opción disponible para recibir todos los productos.</p>}
        {canContinue ? <Link className={`primary-button ${styles.checkoutButton}`} href={`/carrito/${encodeURIComponent(businessId)}/checkout`}>Continuar con el pedido<ArrowRight size={17} aria-hidden="true" /></Link>
          : <button className={`primary-button ${styles.checkoutButton}`} disabled type="button">{catalog.loading ? "Actualizando tu pedido..." : "Continuar con el pedido"}<ArrowRight size={17} aria-hidden="true" /></button>}
        <p className={styles.summaryFootnote}>Los datos de contacto y el pago se completan en el siguiente paso.</p>
      </aside>
    </div>
  </div>;
}

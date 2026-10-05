"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ProductImage } from "@/components/details/product-image";
import { FormError } from "@/components/requests/request-common";
import { ReservationCheckoutFormFields } from "@/components/reservations/reservation-form";
import { ReservationCheckoutFields } from "@/components/reservations/reservation-checkout-fields";
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import { money, type Product } from "@/lib/products";
import { createReservationOrder, readReservations, reservationError } from "@/lib/real-reservations";
import { emptyReservationCheckout, validateReservationCheckout, type ReservationCheckoutInput } from "@/lib/reservation-checkout";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Cart } from "@/lib/cart";
import type { CartBusiness } from "@/lib/cart-catalog";
import { useCart } from "./cart-provider";
import { useCartCatalog } from "./use-cart-catalog";
import styles from "./cart.module.css";

export function CartCheckout({ businessId }: { businessId: string }) {
  const { user, profile, profileLoading } = useAuth();
  const { cartFor, ready } = useCart();
  const catalog = useCartCatalog(businessId);
  const cart = cartFor(businessId);
  if (!ready || profileLoading) return <p className="workflow-loading" role="status">Preparando tu pedido…</p>;
  if (!user) return null;
  if (!cart?.items.length) return <section className="empty-state"><h1>Tu pedido está vacío</h1><p>Elegí productos de un comercio para continuar.</p><Link className="primary-button" href="/carrito">Ver mis pedidos en preparación</Link></section>;
  return <CartCheckoutSession key={`${user.id}:${businessId}`} cart={cart} userId={user.id} initialName={profile?.full_name ?? ""} initialPhone={profile?.phone ?? ""} {...catalog} />;
}

interface CartCheckoutSessionProps {
  cart: Cart;
  userId: string;
  initialName: string;
  initialPhone: string;
  business: CartBusiness | null;
  products: Product[];
  loading: boolean;
  error: string;
  refresh: () => void | Promise<void>;
}

function CartCheckoutSession({ cart, userId, initialName, initialPhone, business, products, loading, error: catalogError, refresh }: CartCheckoutSessionProps) {
  const router = useRouter();
  const { cartFor, beginOrder, releaseOrder, clearCart, setDeliveryType, storageWarning } = useCart();
  const [checkout, setCheckout] = useState<ReservationCheckoutInput>(() => ({ ...emptyReservationCheckout, customer_name: initialName, customer_phone: initialPhone }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<{ id: string; phase: "checking" | "ready" | "error" } | null>(null);
  const [recoveryVersion, setRecoveryVersion] = useState(0);
  const submitting = useRef(false);
  const mounted = useRef(true);
  const checkoutIntent = useRef<{ id: string; checkout: ReservationCheckoutInput } | null>(null);
  const attempt = cart.attempt;
  const differentAccount = Boolean(attempt && attempt.ownerId !== userId);
  const recovering = Boolean(attempt && !differentAccount && (recovery?.id !== attempt.id || recovery?.phase === "checking"));
  const recoveryFailed = Boolean(attempt && recovery?.id === attempt.id && recovery.phase === "error");
  const deliveryType = attempt?.deliveryType ?? cart.deliveryType;
  const catalogAvailable = Boolean(business && !loading && !catalogError);
  const businessName = business?.name ?? cart.businessName;
  const businessSlug = business?.slug ?? cart.businessSlug;
  const lines = cart.items.map(item => ({ item, product: catalogAvailable ? products.find(product => product.id === item.productId && product.storeId === cart.businessId) : undefined }));
  const subtotal = lines.reduce((sum, line) => sum + (line.product?.price ?? line.item.price) * line.item.quantity, 0);
  const pickupEnabled = Boolean(business?.pickup_enabled && lines.every(line => line.product?.pickupToday));
  const deliveryEnabled = Boolean(business?.delivery_enabled && lines.every(line => line.product?.deliveryToday));
  const deliveryPrice = deliveryType === "delivery" ? business?.delivery_price ?? 0 : 0;
  const minimum = business?.minimum_order ?? 0;
  const missingMinimum = Math.max(0, minimum - subtotal);
  const unavailable = lines.filter(line => !line.product || !isProductAvailable(line.product) || (!isOnDemand(line.product) && line.item.quantity > line.product.stock));
  const currentModeAvailable = deliveryType === "pickup" ? pickupEnabled : deliveryEnabled;
  const available = Boolean(business?.active && !loading && !catalogError && !unavailable.length && currentModeAvailable && !missingMinimum);
  const locked = busy || Boolean(checkoutIntent.current) || differentAccount || recovering || recoveryFailed;
  const backUrl = `/carrito/${cart.businessId}`;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    if (!attempt || attempt.ownerId !== userId || submitting.current) return;
    const client = getSupabaseBrowserClient();
    let live = true;
    setRecovery({ id: attempt.id, phase: "checking" });
    if (!client) { setRecovery({ id: attempt.id, phase: "error" }); return; }
    // Only the account-scoped read RPC can recover a committed order after a
    // lost response. No contact or delivery address is persisted in the cart.
    readReservations(client, false, attempt.id).then(rows => {
      if (!live) return;
      if (rows[0]) {
        clearCart(cart.businessId, attempt.id);
        router.replace(`/reserva/${rows[0].id}`);
      } else setRecovery({ id: attempt.id, phase: "ready" });
    }).catch(() => { if (live) setRecovery({ id: attempt.id, phase: "error" }); });
    return () => { live = false; };
    // Recover once for this durable attempt, or when explicitly requested.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt?.id, attempt?.ownerId, userId, recoveryVersion]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || differentAccount || recovering || recoveryFailed || (!attempt && !available)) return;
    if (!attempt) {
      const validation = validateReservationCheckout(checkoutIntent.current?.checkout ?? checkout, deliveryType === "pickup" ? "PICKUP" : "DELIVERY");
      if (validation) { setError(validation); return; }
    }
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos conectar. Revisá tu conexión e intentá nuevamente."); return; }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (attempt) {
        // Requery before retrying: a previous request may have succeeded even
        // when this browser never received its response.
        const recovered = await readReservations(client, false, attempt.id);
        if (!mounted.current) return;
        if (recovered[0]) { clearCart(cart.businessId, attempt.id); router.replace(`/reserva/${recovered[0].id}`); return; }
      }
      const validation = validateReservationCheckout(checkoutIntent.current?.checkout ?? checkout, deliveryType === "pickup" ? "PICKUP" : "DELIVERY");
      if (validation) { setError(validation); return; }
      const intent = beginOrder(cart.businessId, userId);
      if (!intent) { setError("No pudimos preparar el pedido de forma segura. Volvé a tu pedido e intentá nuevamente."); return; }
      setRecovery({ id: intent.id, phase: "ready" });
      const orderCart = cartFor(cart.businessId);
      if (!orderCart?.attempt || orderCart.attempt.id !== intent.id || orderCart.attempt.ownerId !== userId) {
        setError("Tu pedido se actualizó en otra pestaña. Volvé a abrirlo antes de continuar.");
        return;
      }
      const shownItems = cart.items.map(item => `${item.productId}:${item.quantity}`).sort().join("|");
      const currentItems = orderCart.items.map(item => `${item.productId}:${item.quantity}`).sort().join("|");
      if (shownItems !== currentItems || deliveryType !== intent.deliveryType) {
        setError("Tu pedido cambió en otra pestaña. Revisá los productos y la entrega antes de enviarlo nuevamente.");
        return;
      }
      if (checkoutIntent.current?.id !== intent.id) checkoutIntent.current = { id: intent.id, checkout: { ...checkout } };
      const { data, error: failure } = await createReservationOrder(client, {
        id: intent.id,
        items: orderCart.items.map(item => ({ product_id: item.productId, quantity: item.quantity })),
        deliveryType: intent.deliveryType === "pickup" ? "PICKUP" : "DELIVERY",
        checkout: checkoutIntent.current.checkout,
      });
      if (!mounted.current) return;
      if (failure) {
        const definitive = failure.code === "22023" || failure.code === "42501";
        if (definitive) {
          const recovered = await readReservations(client, false, intent.id);
          if (!mounted.current) return;
          if (recovered[0]) { clearCart(cart.businessId, intent.id); router.replace(`/reserva/${recovered[0].id}`); return; }
          // A mismatched retry may refer to an existing order. Keep its ID
          // instead of starting a second order when recovery is inconclusive.
          if (!failure.message.includes("reservation_retry_mismatch")) {
            releaseOrder(cart.businessId, intent.id);
            checkoutIntent.current = null;
          }
          const friendlyError = failure.message.includes("reservation_stock_insufficient") || failure.message.includes("reservation_product_unavailable") || failure.message.includes("reservation_availability_unavailable")
            ? "Uno de los productos cambió de disponibilidad. Revisá tu pedido antes de continuar."
            : failure.message.includes("reservation_delivery_unavailable")
              ? "La modalidad de entrega cambió. Revisá las opciones de tu pedido antes de continuar."
              : failure.message.includes("reservation_payment_unavailable")
                ? "El comercio ya no acepta esa forma de pago. Elegí otra opción para tu pedido."
                : reservationError(failure, true);
          setError(failure.message.includes("reservation_retry_mismatch") ? "Todavía no pudimos recuperar el resultado del pedido anterior. Intentá comprobarlo nuevamente con los mismos datos." : friendlyError === "No pudimos crear la reserva." ? "No pudimos enviar tu pedido. Revisalo y volvé a intentar." : friendlyError);
          await refresh();
        } else setError("No pudimos comprobar si tu pedido se envió. Reintentá con los mismos datos: evitaremos crear otro pedido.");
        return;
      }
      if (data) { clearCart(cart.businessId, intent.id); router.push(`/reserva/${data}`); }
      else setError("No pudimos comprobar el resultado. Reintentá con los mismos datos.");
    } catch {
      if (mounted.current) setError("No pudimos comprobar el resultado. Revisá tu conexión y reintentá con los mismos datos.");
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  if (recovering) return <p className="workflow-loading" role="status">Comprobando el resultado de tu pedido…</p>;
  if (differentAccount) return <section className="panel"><h1>Hay un envío pendiente de otra cuenta</h1><p>Ingresá con la cuenta que inició este pedido para comprobar su resultado.</p><Link className="secondary-link" href="/carrito">Volver a mis pedidos en preparación</Link></section>;
  if (recoveryFailed) return <section className="panel"><h1>Comprobemos tu pedido</h1><p>No pudimos recuperar el resultado anterior. Conservamos tu pedido para evitar enviarlo dos veces.</p><button className="primary-button" type="button" onClick={() => setRecoveryVersion(value => value + 1)}>Comprobar nuevamente</button><Link className="secondary-link" href={backUrl}>Volver a tu pedido</Link></section>;
  if (!attempt && loading) return <p className="workflow-loading" role="status">Actualizando productos y opciones de entrega…</p>;
  if (!attempt && (catalogError || !business)) return <section className="panel"><h1>No pudimos preparar el checkout</h1><p>{catalogError || "Este comercio ya no está disponible."}</p><FormError message={error} /><button className="primary-button" type="button" onClick={() => void refresh()}>Actualizar</button><Link className="secondary-link" href={backUrl}>Volver a tu pedido</Link></section>;

  return <div className="workflow-narrow">
    <Link className="secondary-link" href={backUrl}>Volver a tu pedido</Link>
    <div className="workflow-heading"><span className="eyebrow">Un pedido · un comercio</span><h1>Completá tu pedido</h1><p>{businessName} confirma la disponibilidad antes de preparar tus productos.</p></div>
    <form className="panel workflow-form reservation-form" onSubmit={submit} aria-busy={busy}>
      <section aria-label="Productos de tu pedido">
        <h2>Tu pedido en {businessName}</h2>
        <ul className={styles.orderItems}>{lines.map(({ item, product }) => <li className={styles.orderItem} key={item.productId}>
          <ProductImage className={styles.orderPhoto} src={product?.image ?? item.image} alt={product?.name ?? item.name} />
          <div className={styles.orderItemBody}><strong><Link href={`/producto/${item.productId}`}>{product?.name ?? item.name}</Link></strong><p>{item.quantity} × {money(product?.price ?? item.price)}</p><small>{!catalogAvailable ? "Datos de tu pedido" : product && isOnDemand(product) ? "A pedido" : product ? "Producto del comercio" : "No disponible actualmente"}</small></div>
          <strong className={styles.orderSubtotal}>{money(item.quantity * (product?.price ?? item.price))}</strong>
        </li>)}</ul>
      </section>
      {attempt && <p className="info-note">Conservamos el intento anterior para evitar duplicados. Si volviste a abrir la página, completá los mismos datos de contacto y entrega para reintentar.</p>}
      {catalogAvailable && business ? <ReservationCheckoutFormFields checkout={checkout} onCheckoutChange={setCheckout} deliveryType={deliveryType} onDeliveryChange={value => setDeliveryType(cart.businessId, value)} pickupEnabled={pickupEnabled || Boolean(attempt && deliveryType === "pickup")} deliveryEnabled={deliveryEnabled || Boolean(attempt && deliveryType === "delivery")} deliveryPrice={business.delivery_price} disabled={locked} deliveryDisabled={locked || Boolean(attempt)} businessName={businessName} pickupAddress={business.address} pickupCity={business.city} acceptsCash={business.accepts_cash} acceptsTransfer={business.accepts_transfer} /> : <>
        <p className="info-note">No pudimos consultar las opciones actuales del comercio. Conservamos la modalidad del intento: {deliveryType === "delivery" ? "envío del comercio" : "retiro en comercio"}. Reingresá la misma forma de pago y los mismos datos para comprobarlo; la disponibilidad y el importe se verifican al reintentar.</p>
        <ReservationCheckoutFields value={checkout} onChange={setCheckout} delivery={deliveryType === "delivery"} disabled={locked} acceptsCash acceptsTransfer />
      </>}
      {catalogAvailable && unavailable.length > 0 && <p className="form-error">{unavailable.length === 1 ? `${unavailable[0].product?.name ?? unavailable[0].item.name} ya no está disponible en la cantidad seleccionada.` : "Algunos productos cambiaron de disponibilidad."} Volvé a tu pedido para revisarlos.</p>}
      {catalogAvailable && !currentModeAvailable && <p className="form-error">La modalidad elegida ya no está disponible para todos los productos. Revisá las opciones de entrega.</p>}
      {catalogAvailable && minimum > 0 && <p className="info-note">Compra mínima: {money(minimum)}. {missingMinimum ? `Te faltan ${money(missingMinimum)} para alcanzarla.` : "✓ Alcanzaste la compra mínima."}</p>}
      <dl className="reservation-totals"><div><dt>{catalogAvailable ? "Subtotal" : "Subtotal estimado"}</dt><dd>{money(subtotal)}</dd></div><div><dt>{deliveryType === "delivery" ? "Envío del comercio" : "Retiro en comercio"}</dt><dd>{!catalogAvailable ? "A confirmar" : deliveryPrice ? money(deliveryPrice) : "Gratis"}</dd></div><div className="reservation-total"><dt>Total estimado</dt><dd>{catalogAvailable ? money(subtotal + deliveryPrice) : "A confirmar"}</dd></div></dl>
      <p className="info-note">El comercio recibe un único pedido. El precio y envío vigentes se confirman al enviarlo. Si no lo confirma en 30 minutos, vence. No se realiza ningún cobro.</p>
      {storageWarning && <p className="workflow-warning" role="alert">{storageWarning}</p>}
      <FormError message={error} />
      <button className="primary-button" type="submit" disabled={busy || (!attempt && !available)}>{busy ? "Enviando pedido…" : attempt ? "Comprobar y reintentar pedido" : "Enviar pedido"}</button>
      <Link className="secondary-link" href={`/tienda/${businessSlug}`}>Seguir comprando</Link>
    </form>
  </div>;
}

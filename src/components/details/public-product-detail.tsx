import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { ArrowUpRight, Check, Clock3, MessageCircle, PackageCheck, PackageX, Store } from "lucide-react";
import type { Product } from "@/lib/products";
import { money } from "@/lib/products";
import { argentinaWhatsAppUrl, formatArgentinaPhone } from "@/lib/phone";
import { DetailGallery } from "./detail-gallery";
import styles from "./public-details.module.css";
import { placeholderImage } from "@/lib/public-catalog";
import { StockTime } from "./stock-time";
import { SaveProduct } from "./save-product";
import { BusinessDistance } from "../location/business-distance";
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import { AddToOrder } from "../cart/add-to-order";
import { ReportButton } from "../reports/report-button";

export function PublicProductDetail({ product, returnTo = "/" }: { product: Product; returnTo?: string }) {
  if (!product.database) return null;
  const { product: row, business, category } = product.database;
  const onDemand = isOnDemand(product);
  const available = isProductAvailable(product);
  const whatsapp = argentinaWhatsAppUrl(business.whatsapp, `Hola, vi ${product.name} en CercaYa. ¿Lo tenés disponible?`);
  return <><BackLink href={returnTo}>Volver a resultados</BackLink><div className={styles.page}>
    <div className={styles.layout}><DetailGallery title={product.name} photos={product.image && product.image !== placeholderImage ? [{ id: product.id, src: product.image }] : []} />
      <section className={styles.summary}><span className={styles.eyebrow}>Producto de comercio · {category.name}</span><h1>{product.name}</h1><strong className={styles.price}>{money(product.price)}</strong><p data-detail-meta>{business.name} · {business.city || "Localidad sin informar"}</p>
        {onDemand ? <div className="product-stock-summary"><strong className={`request-status ${available ? "open" : "closed"}`}>Se prepara a pedido</strong><span>{available ? "Disponible hoy" : "No disponible hoy"}</span></div> : <><div className="product-stock-summary"><strong className={`request-status ${product.stock > 0 ? "open" : "closed"}`}>{product.stock > 0 ? <PackageCheck size={16} aria-hidden="true" /> : <PackageX size={16} aria-hidden="true" />}{product.stock > 0 ? "En stock" : "Sin stock"}</strong><span>{product.stock} unidades</span></div><div className={`stock-confirmation ${row.stock_confirmed_at ? "" : "unconfirmed"}`}><span>{row.stock_confirmed_at ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}<StockTime date={row.stock_confirmed_at} /></span></div></>}
        <p data-detail-meta>Disponibilidad informada por el comercio.</p><dl className="request-facts"><div><dt>Marca</dt><dd>{row.brand || "Sin informar"}</dd></div><div><dt>Modelo</dt><dd>{row.model || "Sin informar"}</dd></div><div><dt>Retiro</dt><dd>{product.pickupToday ? "Disponible" : "No disponible"}</dd></div><div><dt>Envío</dt><dd>{product.deliveryToday ? "Disponible" : "No disponible"}</dd></div></dl>
        <AddToOrder product={product} />
        {whatsapp && <a className="outline-button product-reserve" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />Hablar por WhatsApp</a>}
        <p data-detail-meta>Podés sumar otros productos de esta tienda. Al continuar, elegís cómo recibir tu pedido y se lo enviás al comercio para que lo confirme. No se realiza ningún cobro.</p><section className={styles.section}><h2>Sobre este producto</h2><p className={styles.description}>{product.description || "Sin descripción adicional."}</p></section>        <section id="comercio" className={styles.section}><span className={styles.eyebrow}>Vendido por</span><h2><Link href={`/tienda/${encodeURIComponent(business.slug)}`}>{business.name}</Link></h2><Link className="secondary-link" href={`/tienda/${encodeURIComponent(business.slug)}`}><Store size={16} aria-hidden="true" />Ver tienda<ArrowUpRight size={16} aria-hidden="true" /></Link><div><BusinessDistance latitude={business.latitude} longitude={business.longitude} /><small>Distancia aproximada cuando tu ubicación está disponible.</small></div><p>{business.city || "Ciudad sin informar"}<br />{business.address || "Consultá la ubicación al comercio"}</p><p>WhatsApp: {formatArgentinaPhone(business.whatsapp)}</p><p>El comercio {business.pickup_enabled ? "permite retiro" : "no ofrece retiro"} y {business.delivery_enabled ? "realiza envíos" : "no realiza envíos"}.</p></section>
<SaveProduct id={product.id} />
        <ReportButton entity="product" id={row.id} name={product.name} />
      </section>
    </div></div></>;
}


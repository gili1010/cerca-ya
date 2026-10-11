import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { ArrowUpRight, Check, Clock3, MessageCircle, PackageCheck, PackageX, Store } from "lucide-react";
import type { Product } from "@/lib/products";
import { money } from "@/lib/products";
import { argentinaWhatsAppUrl, formatArgentinaPhone } from "@/lib/phone";
import { ProductImage } from "./product-image";
import { StockTime } from "./stock-time";
import { SaveProduct } from "./save-product";
import { BusinessDistance } from "../location/business-distance";
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import { AddToOrder } from "../cart/add-to-order";
import { ReportButton } from "../reports/report-button";

export function PublicProductDetail({ product }: { product: Product }) {
  if (!product.database) return null;
  const { product: row, business, category } = product.database;
  const onDemand = isOnDemand(product);
  const available = isProductAvailable(product);
  const whatsapp = argentinaWhatsAppUrl(business.whatsapp, `Hola, vi ${product.name} en CercaYa. ¿Lo tenés disponible?`);
  return <><BackLink href="/">Volver a explorar</BackLink>
    <div className="product-detail-grid"><div className="product-detail-photo"><ProductImage src={product.image} alt={product.name} className="public-detail-image" /></div>
      <section className="panel product-detail-info"><span className="eyebrow">{category.name}</span><h1>{product.name}</h1><strong className="offer-price">{money(product.price)}</strong><p>{product.description || "Sin descripción."}</p>
        {onDemand ? <div className="product-stock-summary"><strong className={`request-status ${available ? "open" : "closed"}`}>Se prepara a pedido</strong><span>{available ? "Disponible hoy" : "No disponible hoy"}</span></div> : <><div className="product-stock-summary"><strong className={`request-status ${product.stock > 0 ? "open" : "closed"}`}>{product.stock > 0 ? <PackageCheck size={16} aria-hidden="true" /> : <PackageX size={16} aria-hidden="true" />}{product.stock > 0 ? "En stock" : "Sin stock"}</strong><span>{product.stock} unidades</span></div><div className={`stock-confirmation ${row.stock_confirmed_at ? "" : "unconfirmed"}`}><span>{row.stock_confirmed_at ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}<StockTime date={row.stock_confirmed_at} /></span></div></>}
        <dl className="request-facts"><div><dt>Marca</dt><dd>{row.brand || "Sin informar"}</dd></div><div><dt>Modelo</dt><dd>{row.model || "Sin informar"}</dd></div><div><dt>Retiro</dt><dd>{product.pickupToday ? "Disponible" : "No disponible"}</dd></div><div><dt>Envío</dt><dd>{product.deliveryToday ? "Disponible" : "No disponible"}</dd></div></dl>
        <section id="comercio"><h2><Link href={`/tienda/${encodeURIComponent(business.slug)}`}>{business.name}</Link></h2><Link className="secondary-link" href={`/tienda/${encodeURIComponent(business.slug)}`}><Store size={16} aria-hidden="true" />Ver tienda<ArrowUpRight size={16} aria-hidden="true" /></Link><BusinessDistance latitude={business.latitude} longitude={business.longitude} /><p>{business.city || "Ciudad sin informar"}<br />{business.address || "Consultá la ubicación al comercio"}</p><p>WhatsApp: {formatArgentinaPhone(business.whatsapp)}</p><p>El comercio {business.pickup_enabled ? "permite retiro" : "no ofrece retiro"} y {business.delivery_enabled ? "realiza envíos" : "no realiza envíos"}.</p></section>
        <AddToOrder product={product} />
        {whatsapp && <a className="outline-button product-reserve" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />Hablar por WhatsApp</a>}
        <p className="info-note">Podés sumar otros productos de esta tienda. Al continuar, elegís cómo recibir tu pedido y se lo enviás al comercio para que lo confirme. No se realiza ningún cobro.</p><SaveProduct id={product.id} />
        <ReportButton entity="product" id={row.id} name={product.name} />
      </section>
    </div></>;
}


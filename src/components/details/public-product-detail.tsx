import Link from "next/link";
import { Check, Clock3, MessageCircle, PackageCheck, PackageX } from "lucide-react";
import type { Product } from "@/lib/products";
import { money } from "@/lib/products";
import { ProductImage } from "./product-image";
import { StockTime } from "./stock-time";
import { SaveProduct } from "./save-product";
import { BusinessDistance } from "../location/business-distance";

export function PublicProductDetail({ product }: { product: Product }) {
  if (!product.database) return null;
  const { product: row, business, category } = product.database;
  const phone = business.whatsapp?.replace(/\D/g, "") ?? "";
  const whatsapp = /^\d{8,15}$/.test(phone) ? `https://wa.me/${phone}?text=${encodeURIComponent(`Hola, vi ${product.name} en CercaYa. ¿Lo tenés disponible?`)}` : null;
  return <><Link className="secondary-link" href="/">Volver a explorar</Link>
    <div className="product-detail-grid"><div className="product-detail-photo"><ProductImage src={product.image} alt={product.name} className="public-detail-image" /></div>
      <section className="panel product-detail-info"><span className="eyebrow">{category.name}</span><h1>{product.name}</h1><strong className="offer-price">{money(product.price)}</strong><p>{product.description || "Sin descripción."}</p>
        <div className="product-stock-summary"><strong className={`request-status ${product.stock > 0 ? "open" : "closed"}`}>{product.stock > 0 ? <PackageCheck size={16} aria-hidden="true" /> : <PackageX size={16} aria-hidden="true" />}{product.stock > 0 ? "En stock" : "Sin stock"}</strong><span>{product.stock} unidades</span></div><div className={`stock-confirmation ${row.stock_confirmed_at ? "" : "unconfirmed"}`}><span>{row.stock_confirmed_at ? <Check size={14} aria-hidden="true" /> : <Clock3 size={14} aria-hidden="true" />}<StockTime date={row.stock_confirmed_at} /></span></div>
        <dl className="request-facts"><div><dt>Marca</dt><dd>{row.brand || "Sin informar"}</dd></div><div><dt>Modelo</dt><dd>{row.model || "Sin informar"}</dd></div><div><dt>Retiro</dt><dd>{product.pickupToday ? "Disponible" : "No disponible"}</dd></div><div><dt>Envío</dt><dd>{product.deliveryToday ? "Disponible" : "No disponible"}</dd></div></dl>
        <section id="comercio"><h2>{business.name}</h2><BusinessDistance latitude={business.latitude} longitude={business.longitude} /><p>{business.city || "Ciudad sin informar"}<br />{business.address || "Consultá la ubicación al comercio"}</p><p>WhatsApp: {business.whatsapp || "Sin informar"}</p><p>El comercio {business.pickup_enabled ? "permite retiro" : "no ofrece retiro"} y {business.delivery_enabled ? "realiza envíos" : "no realiza envíos"}.</p></section>
        {product.stock > 0 && (product.pickupToday || product.deliveryToday) ? <Link className="primary-button product-reserve" href={`/producto/${product.id}/reservar`}><PackageCheck size={18} aria-hidden="true" />Reservar</Link> : <button className="primary-button product-reserve" disabled>{product.stock === 0 ? "Sin stock para reservar" : "Consultá cómo comprar al comercio"}</button>}
        {whatsapp && <a className="outline-button product-reserve" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />Hablar por WhatsApp</a>}
        <p className="info-note">Tu reserva se envía al comercio. El stock se descuenta cuando la confirma; si sigue pendiente, vence en 30 minutos. No se realiza ningún cobro.</p><SaveProduct id={product.id} />
      </section>
    </div></>;
}


import Image from "next/image";
import cardStyles from "./product-card.module.css";
import Link from "next/link";
import { Check, Clock3, Heart, Store, Truck } from "lucide-react";
import { confirmationTime, money, photo, type Product } from "@/lib/products";
import { ProductImage } from "../details/product-image";
import { StockTime } from "../details/stock-time";
import { isOnDemand, isProductAvailable } from "@/lib/product-availability";
import localityStyles from "./catalog-locality.module.css";
import { personalSearchReturnTo } from "@/lib/search-navigation";

export function StockConfirmation({ product }: { product: Product }) {
  if (isOnDemand(product)) return <div className={`stock-confirmation ${isProductAvailable(product) ? "" : "unconfirmed"}`}><span>{isProductAvailable(product) ? <Check size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}Se prepara a pedido</span><small>Informado por el comercio</small></div>;
  if (product.database) return <div className={`stock-confirmation ${product.database.product.stock_confirmed_at ? "" : "unconfirmed"}`}><span>{product.database.product.stock_confirmed_at ? <Check size={13} aria-hidden="true" /> : <Clock3 size={13} aria-hidden="true" />}<StockTime date={product.database.product.stock_confirmed_at} /></span><small>Informado por el comercio</small></div>;
  return <div className={`stock-confirmation ${product.confirmedMinutesAgo === null ? "unconfirmed" : ""}`}>
    <span>{product.confirmedMinutesAgo === null ? <Clock3 size={13} /> : <Check size={13} />}{product.confirmedMinutesAgo === null ? "Stock por confirmar" : "Stock confirmado"}</span>
    <small>{product.confirmedMinutesAgo === null ? "Consultá antes de acercarte" : `Hace ${product.confirmedMinutesAgo} min · ${confirmationTime(product.confirmedMinutesAgo)}`}</small>
  </div>;
}

interface ProductCardProps { product: Product; saved: boolean; onSave: (id: string) => void; localityMatch?: boolean; returnTo?: string }

export function ProductCard({ product, saved, onSave, localityMatch = false, returnTo }: ProductCardProps) {
  const real = product.source === "supabase";
  const href = `/producto/${product.id}${returnTo ? `?returnTo=${encodeURIComponent(personalSearchReturnTo(returnTo))}` : ""}`;
  const storeSlug = product.database?.business.slug;
  const storeHref = real ? storeSlug ? `/tienda/${encodeURIComponent(storeSlug)}` : `${href}#comercio` : `/demo/comercios/${product.storeId}`;
  return <article className={`product-card ${cardStyles.card}`}>
    <div className={`product-image ${cardStyles.imageFrame}`}>
      <Link className="product-image-link" href={href} aria-label={`Ver ${product.name}`}>{real ? <ProductImage src={product.image} alt={product.name} className="public-card-image" /> : <Image src={photo(product.image)} alt={product.name} fill sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw" />}</Link>
      <button className={`save-button ${saved ? "saved" : ""}`} aria-label={`${saved ? "Quitar de" : "Agregar a"} guardados: ${product.name}`} aria-pressed={saved} onClick={() => onSave(product.id)}><Heart size={18} fill={saved ? "currentColor" : "none"} /></button>
    </div>
    <div className="product-body">
      {real && <small className="public-card-category">{product.category}</small>}
      <h3><Link href={href}>{product.name}</Link></h3>
      <strong className="product-price">{money(product.price)}</strong>
      <div className="product-store"><Store size={14} /><Link href={storeHref} aria-label={real ? `Ver tienda de ${product.store}` : undefined}>{product.store}{real && storeSlug ? " ›" : ""}</Link></div>
      {real ? <div className="fulfillment public-fulfillment">{product.pickupToday && <span><Store size={15} />Retiro disponible</span>}{product.deliveryToday && <span className={localityMatch ? localityStyles.shipping : undefined}><Truck size={15} />{localityMatch ? "Este comercio realiza envíos · Consultá cobertura" : "Envío disponible"}</span>}{!product.pickupToday && !product.deliveryToday && <span>Consultá al comercio</span>}</div> : <div className="fulfillment">{product.deliveryToday ? <><Truck size={15} /><strong>Entrega hoy</strong></> : product.pickupToday ? <><Store size={15} /><strong>{product.pickupMinutes !== null && product.pickupMinutes <= 15 ? "Retiro inmediato" : "Retirá hoy"}</strong></> : <><Clock3 size={15} /><strong>Desde mañana</strong></>}{product.deliveryToday && product.pickupToday && <span>o retiro</span>}</div>}

      {returnTo && <Link className={`secondary-link ${cardStyles.detailAction}`} href={href}>Ver producto ›</Link>}
    </div>
  </article>;
}



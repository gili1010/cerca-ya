import { ArrowDown, Facebook, Instagram, MapPin, MessageCircle, Store, Truck } from "lucide-react";
import { normalizeSocialLink } from "@/lib/businesses/social-links";
import type { PublicStore } from "@/lib/public-store-server";
import { argentinaWhatsAppUrl, formatArgentinaPhone } from "@/lib/phone";
import { money } from "@/lib/products";
import { BusinessDistance } from "../location/business-distance";
import { StoreAssetImage } from "./store-asset-image";
import { StoreShare } from "./store-share";
import styles from "./store.module.css";
import { ReportButton } from "../reports/report-button";
import { VerificationBadge } from "../businesses/verification-badge";
import { BusinessHoursStatus } from "../businesses/business-hours-status";

export function StoreHeader({ business, categories, hours }: Pick<PublicStore, "business" | "categories" | "hours">) {
  const instagram = normalizeSocialLink(business.instagram_url ?? "", "instagram");
  const facebook = normalizeSocialLink(business.facebook_url ?? "", "facebook");
  const whatsapp = argentinaWhatsAppUrl(business.whatsapp, `Hola, vi la tienda de ${business.name} en CercaYa. Quería consultar por sus productos.`);
  return <header className={styles.storeHeader}>
    <StoreAssetImage url={business.cover_url} businessId={business.id} kind="cover" name={business.name} />
    <div className={styles.header}>
    <div className={styles.identity}>
      <StoreAssetImage url={business.logo_url} businessId={business.id} kind="logo" name={business.name} />
      <span className={styles.storeLabel}><Store size={18} aria-hidden="true" />TIENDA EN CERCAYA</span>
      <div className={styles.titleRow}><h1 className={styles.name}>{business.name}</h1>{business.verified && <VerificationBadge />}</div>
      {categories.length > 0 && <ul className={styles.businessCategories} aria-label="Categorías del comercio">
        {categories.map(category => <li key={category.id}>{category.name}</li>)}
      </ul>}
      <div className={styles.location}>
        {business.city && <p><MapPin size={17} aria-hidden="true" />{business.city}</p>}
        <BusinessDistance latitude={business.latitude} longitude={business.longitude} />
      </div>
      {hours ? <BusinessHoursStatus schedule={hours} /> : <p className={styles.hoursUnavailable}>Horario no disponible</p>}
      {business.description.trim() && <p className={styles.description}>{business.description}</p>}
      <div className={styles.headerActions}><a className={`primary-button ${styles.explore}`} href="#productos">Ver productos<ArrowDown size={16} aria-hidden="true" /></a><StoreShare name={business.name} slug={business.slug} /></div>
      {(instagram || facebook) && <nav className={styles.socialLinks} aria-label="Redes sociales del comercio"><span>Seguinos</span><div>
        {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer"><Instagram size={17} aria-hidden="true" />Instagram</a>}
        {facebook && <a href={facebook} target="_blank" rel="noopener noreferrer"><Facebook size={17} aria-hidden="true" />Facebook</a>}
      </div></nav>}
      <ReportButton entity="business" id={business.id} name={business.name} />
    </div>
    <section className={styles.purchase} aria-labelledby="store-purchase-title">
      <h2 id="store-purchase-title">En este comercio</h2>
      <dl className={styles.methods}>
        <div><dt><Store size={20} aria-hidden="true" />Retiro</dt><dd>{business.pickup_enabled ? "Disponible en el comercio" : "No disponible"}</dd></div>
        <div><dt><Truck size={20} aria-hidden="true" />Envío</dt><dd>{business.delivery_enabled ? "Disponible" : "No disponible"}{business.delivery_enabled && <small>{business.delivery_price === 0 ? "Sin costo de envío" : `Costo de envío: ${money(business.delivery_price)}`}</small>}</dd></div>
      </dl>
      {business.whatsapp?.trim() && <div className={styles.contact}>
        <p>WhatsApp <span>{formatArgentinaPhone(business.whatsapp)}</span></p>
        {whatsapp && <a className={`primary-button ${styles.contactButton}`} href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />Consultar al comercio</a>}
      </div>}
    </section>
    </div>
  </header>;
}

import { ArrowDown, CreditCard, Facebook, Instagram, MapPin, MessageCircle, Store, Truck } from "lucide-react";
import { normalizeSocialLink } from "@/lib/businesses/social-links";
import type { PublicStore } from "@/lib/public-store-server";
import { argentinaWhatsAppUrl, formatArgentinaPhone } from "@/lib/phone";
import { money } from "@/lib/products";
import { BusinessDistance } from "../location/business-distance";
import { StoreAssetImage } from "./store-asset-image";
import { StoreShare } from "./store-share";
import { ReportButton } from "../reports/report-button";
import { VerificationBadge } from "../businesses/verification-badge";
import { BusinessHoursStatus } from "../businesses/business-hours-status";
import styles from "./store-header.module.css";

export function StoreHeader({ business, categories, hours, products }: Pick<PublicStore, "business" | "categories" | "hours" | "products">) {
  const instagram = normalizeSocialLink(business.instagram_url ?? "", "instagram");
  const facebook = normalizeSocialLink(business.facebook_url ?? "", "facebook");
  const whatsapp = argentinaWhatsAppUrl(business.whatsapp, `Hola, vi la tienda de ${business.name} en CercaYa. Quería consultar por sus productos.`);
  // Presentation only: identical URLs represent the same resource, not similar images.
  const coverUrl = business.cover_url?.trim();
  const showCover = Boolean(coverUrl && coverUrl !== business.logo_url?.trim());
  const paymentInfo = products.find(product => product.database?.business.id === business.id)?.database?.business;
  const paymentMethods = [paymentInfo?.accepts_cash ? "Efectivo" : null, paymentInfo?.accepts_transfer ? "Transferencia" : null].filter(Boolean);
  return <header className={styles.storeHeader}>
    {showCover && <div className={styles.coverFrame}>
      <StoreAssetImage url={business.cover_url} businessId={business.id} kind="cover" name={business.name} />
    </div>}
    <div className={styles.content}>
      <div className={styles.details}>
        <div className={styles.identity}>
          <div className={styles.logoFrame}>
            <StoreAssetImage url={business.logo_url} businessId={business.id} kind="logo" name={business.name} />
          </div>
          <div className={styles.identityText}>
            <span className={styles.storeLabel}>TIENDA EN CERCAYA</span>
            <div className={styles.titleRow}>
              <h1 className={styles.name}>{business.name}</h1>
              {business.verified && <VerificationBadge />}
            </div>
            {categories.length > 0 && <ul className={styles.businessCategories} aria-label="Categorías del comercio">
              {categories.map(category => <li key={category.id}>{category.name}</li>)}
            </ul>}
          </div>
        </div>
        <div className={styles.facts}>
          <div className={styles.location}>
            {business.city && <p><MapPin size={17} aria-hidden="true" />{[business.city, business.province].filter(Boolean).join(", ")}</p>}
            <BusinessDistance latitude={business.latitude} longitude={business.longitude} />
          </div>
          <div className={styles.hours}>
            {hours ? <BusinessHoursStatus schedule={hours} /> : <p className={styles.hoursUnavailable}>Horario no disponible</p>}
          </div>
        </div>
        {business.description.trim() && <p className={styles.description}>{business.description}</p>}
        <div className={styles.headerActions}>
          <a className={`primary-button ${styles.explore}`} href="#productos">Ver productos<ArrowDown size={16} aria-hidden="true" /></a>
          <div className={styles.shareAction}><StoreShare name={business.name} slug={business.slug} /></div>
        </div>
        <div className={styles.secondaryActions}>
          {(instagram || facebook) && <nav className={styles.socialLinks} aria-label="Redes sociales del comercio">
            <span>Seguinos</span>
            <div>
              {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer"><Instagram className={styles.instagramIcon} size={17} aria-hidden="true" />Instagram</a>}
              {facebook && <a href={facebook} target="_blank" rel="noopener noreferrer"><Facebook className={styles.facebookIcon} size={17} aria-hidden="true" />Facebook</a>}
            </div>
          </nav>}
          <div className={styles.reportAction}><ReportButton entity="business" id={business.id} name={business.name} /></div>
        </div>
      </div>
      <section className={styles.purchase} aria-labelledby="store-purchase-title">
        <h2 id="store-purchase-title">Cómo comprar</h2>
        <dl className={styles.methods}>
          <div><dt><Store size={20} aria-hidden="true" />Retiro</dt><dd>{business.pickup_enabled ? "Disponible en el comercio" : "No disponible"}</dd></div>
          <div><dt><Truck size={20} aria-hidden="true" />Envío</dt><dd>{business.delivery_enabled ? "Consultá la cobertura" : "No disponible"}{business.delivery_enabled && <small>{business.delivery_price === 0 ? "Sin costo de envío" : `Costo de envío: ${money(business.delivery_price)}`}</small>}</dd></div>
          {paymentMethods.length > 0 && <div><dt><CreditCard size={20} aria-hidden="true" />Medios de pago</dt><dd>{paymentMethods.join(" · ")}</dd></div>}
        </dl>
        {business.whatsapp?.trim() && <div className={styles.contact}>
          <p>WhatsApp <span>{formatArgentinaPhone(business.whatsapp)}</span></p>
          {whatsapp && <a className={`primary-button ${styles.contactButton}`} href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} aria-hidden="true" />Consultar al comercio</a>}
        </div>}
      </section>
    </div>
  </header>;
}

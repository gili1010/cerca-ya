"use client";

import { DetailGallery } from "@/components/details/detail-gallery";
import detailStyles from "@/components/details/public-details.module.css";
import { useState } from "react";
import { MapPin, MessageCircle, UserRound, Tag } from "lucide-react";
import type { PersonalListingPresentation } from "@/types/personal-listings";
import { personalArticleMoney } from "@/lib/personal-listings/form";
import { argentinaWhatsAppUrl, formatArgentinaPhone } from "@/lib/phone";
import { ProductImage } from "@/components/details/product-image";
import { placeholderImage } from "@/lib/public-catalog";
import styles from "./personal-listings.module.css";

export function ArticlePresentation({ listing, photoUrls, preview = false, ownerView = false, publicDetail = false }: {
  listing: PersonalListingPresentation; photoUrls: Record<string, string>; preview?: boolean; ownerView?: boolean; publicDetail?: boolean;
}) {
  const Title = preview ? "h2" : "h1";
  const [selected, setSelected] = useState(0);
  const image = listing.images[Math.min(selected, Math.max(0, listing.images.length - 1))];
  const whatsapp = listing.contact_whatsapp ? argentinaWhatsAppUrl(listing.contact_whatsapp, `Hola, vi tu artículo “${listing.title}” en CercaYa. ¿Sigue disponible?`) : null;
  return <article className={publicDetail ? `${detailStyles.page} ${detailStyles.layout} ${detailStyles.publicArticle}` : styles.article}>{publicDetail ? <DetailGallery title={listing.title} photos={listing.images.map(photo => ({ id: photo.object_path, src: photoUrls[photo.object_path] }))} /> : <div className={styles.gallery}><div className={styles.mainPhoto}><ProductImage src={image ? photoUrls[image.object_path] ?? placeholderImage : placeholderImage} alt={listing.title} /></div>
    {listing.images.length > 1 && <div className={styles.thumbnails} aria-label="Fotos del artículo">{listing.images.map((photo, index) => <button key={photo.object_path} type="button" aria-label={`Ver foto ${index + 1}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><ProductImage src={photoUrls[photo.object_path] ?? placeholderImage} alt={`${listing.title}, foto ${index + 1}`} /></button>)}</div>}</div>}
    <div className={publicDetail ? `${styles.articleInfo} ${detailStyles.summary}` : styles.articleInfo}><span className={styles.badge}>{listing.item_condition === "NEW" ? "Nuevo" : "Usado"}</span><Title data-preview-title={preview || undefined}>{listing.title}</Title>
      <strong className={styles.price}>{personalArticleMoney(listing.price)}</strong>{listing.negotiable && <span className={styles.metadata}>Precio negociable</span>}
      <p className={styles.location}><MapPin size={18} aria-hidden="true" />{listing.city}, {listing.province}</p>
      <p className={styles.metadata}><Tag size={16} aria-hidden="true" />{listing.category_name}</p>
      {publicDetail && <p className={styles.metadata}>Publicado por {listing.seller_display_name || "Vendedor particular"}</p>}
      {!publicDetail && <><div className={styles.description}><h2>Sobre este artículo</h2><p>{listing.description || "Sin descripción adicional."}</p></div>
      <div className={styles.seller}><UserRound size={21} aria-hidden="true" /><div><small>PUBLICADO POR UN PARTICULAR</small><strong>{listing.seller_display_name || "Vendedor particular"}</strong></div></div></>}
      {preview || ownerView ? <div className={styles.contactPreview}><MessageCircle size={19} aria-hidden="true" /><span>WhatsApp: {listing.contact_whatsapp ? formatArgentinaPhone(listing.contact_whatsapp) : "Todavía no indicado"}</span></div>
        : whatsapp && <a className="primary-button" href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={20} aria-hidden="true" />Consultar al vendedor</a>}
      {publicDetail && <><div className={styles.description}><h2>Sobre este artículo</h2><p>{listing.description || "Sin descripción adicional."}</p></div>
      <div className={styles.seller}><UserRound size={21} aria-hidden="true" /><div><small>PUBLICADO POR UN PARTICULAR</small><strong>{listing.seller_display_name || "Vendedor particular"}</strong></div></div></>}
      <p className={styles.metadata}>{preview ? "Vista previa: todavía no confirma la publicación." : ownerView ? "Vista privada del vendedor. La disponibilidad pública depende del estado del anuncio." : "Coordiná con el vendedor. CercaYa no procesa el pago ni reserva este artículo."}</p>
    </div></article>;
}

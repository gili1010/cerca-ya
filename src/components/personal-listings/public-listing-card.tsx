import Link from "next/link";
import { MapPin } from "lucide-react";
import type { PublicPersonalListing } from "@/types/personal-listings";
import { personalArticleMoney } from "@/lib/personal-listings/form";
import { placeholderImage } from "@/lib/public-catalog";
import { ProductImage } from "@/components/details/product-image";
import styles from "./personal-search.module.css";

export function PublicListingCard({ listing, photoUrl, returnTo }: { listing: PublicPersonalListing; photoUrl?: string; returnTo: string }) {
  return <Link className={styles.card} href={`/articulo/${listing.id}?returnTo=${encodeURIComponent(returnTo)}`}>
    <div className={styles.photo}><ProductImage src={photoUrl ?? placeholderImage} alt={listing.title} /></div>
    <div className={styles.cardBody}><div className={styles.badges}><span>Particular</span><span>{listing.item_condition === "NEW" ? "Nuevo" : "Usado"}</span></div>
      <h3>{listing.title}</h3><strong className={styles.price}>{personalArticleMoney(listing.price)}</strong>
      <p className={styles.location}><MapPin size={15} aria-hidden="true" />{listing.city}, {listing.province}</p>
      <span className="secondary-link">Ver artículo ›</span>
    </div>
  </Link>;
}


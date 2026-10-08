"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, MapPin, Store, Truck } from "lucide-react";
import type { StoreSearchBusiness } from "@/lib/public-store-search";
import { storeAssetPath } from "@/lib/business-assets";
import { businessDistance, formatDistance } from "@/lib/distance";
import { useUserLocation } from "../location/user-location-provider";
import styles from "./store-search.module.css";
import { VerificationBadge } from "../businesses/verification-badge";

export function StoreCard({ store }: { store: StoreSearchBusiness }) {
  const { coordinates } = useUserLocation();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logo = store.logo_url && failedUrl !== store.logo_url && storeAssetPath(store.logo_url, store.id, "logo") ? store.logo_url : null;
  const distance = businessDistance(coordinates, store);
  return <article className={styles.cardContainer}><Link className={styles.card} href={`/tienda/${encodeURIComponent(store.slug)}`}>
    <div className={styles.logo}>
      {logo ? /* eslint-disable-next-line @next/next/no-img-element */
        <img src={logo} alt="" width={64} height={64} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(logo)} />
        : <Store size={26} aria-hidden="true" />}
    </div>
    <div className={styles.body}>
      <h4 className={store.verified ? styles.verifiedName : undefined}>{store.name}</h4>
      {(store.categories.length > 0 || store.city) && <p className={styles.meta}>{[store.categories.map(category => category.name).join(" · "), store.city].filter(Boolean).join(" · ")}</p>}
      {distance !== null && <span className={styles.distance}><MapPin size={14} aria-hidden="true" />A {formatDistance(distance)} de vos</span>}
      {(store.pickup_enabled || store.delivery_enabled) && <div className={styles.fulfillment}>
        {store.pickup_enabled && <span><Store size={13} aria-hidden="true" />Retiro</span>}
        {store.delivery_enabled && <span><Truck size={13} aria-hidden="true" />Envío</span>}
      </div>}
      <span className={styles.visit}>Ver tienda<ArrowUpRight size={16} aria-hidden="true" /></span>
    </div>
  </Link>{store.verified && <div className={styles.cardVerification}><VerificationBadge compact /></div>}</article>;
}

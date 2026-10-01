"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Paintbrush, Store } from "lucide-react";
import type { BusinessRow } from "@/types/database";
import { StoreShare } from "./store-share";
import { StoreQr } from "./store-qr";
import styles from "./store.module.css";

export function MerchantStoreCard({ business }: { business: Pick<BusinessRow, "name" | "slug" | "active"> }) {
  const path = `/tienda/${encodeURIComponent(business.slug)}`;
  const [url, setUrl] = useState("");
  useEffect(() => { setUrl(new URL(path, window.location.origin).toString()); }, [path]);
  return <section className={`panel ${styles.merchantCard}`}>
    <div className={styles.merchantCardTitle}><span className={styles.merchantIcon}><Store size={26} aria-hidden="true" /></span><div><span className="eyebrow">TU TIENDA CERCAYA</span><h2>{business.active ? "Tu tienda está online" : "Tu tienda está inactiva"}</h2></div></div>
    <p>Compartí tu tienda con tus clientes. Los productos y precios se actualizan automáticamente cuando modificás tu catálogo.</p>
    <p className={styles.storeUrl}>{url || path}</p>
    {business.active ? <>
      <div className={styles.merchantLinks}><Link className="primary-button" href={path} target="_blank" rel="noopener noreferrer">Ver mi tienda<ArrowUpRight size={17} aria-hidden="true" /></Link><Link className="secondary-link" href="/comercio/mi-negocio#mi-tienda"><Paintbrush size={17} aria-hidden="true" />Personalizar mi tienda</Link></div>
      <StoreShare name={business.name} slug={business.slug} showCopy />
      <StoreQr name={business.name} slug={business.slug} url={url} />
    </> : <p className="info-note">La página pública estará disponible cuando el comercio esté activo.</p>}
  </section>;
}

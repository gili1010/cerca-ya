"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Link2, Paintbrush, Store } from "lucide-react";
import type { BusinessRow } from "@/types/database";
import { StoreShare } from "./store-share";
import { StoreQr } from "./store-qr";
import { StoreSlugEditor } from "./store-slug-editor";
import { useMyBusiness } from "../businesses/business-provider";
import styles from "./merchant-store.module.css";
import { useMarkStoreShared } from "../onboarding/use-mark-store-shared";

export function MerchantStoreCard({ business }: { business: Pick<BusinessRow, "id" | "name" | "slug" | "active"> }) {
  const { updateSlug } = useMyBusiness();
  const markShared = useMarkStoreShared(business.id);
  const [notice, setNotice] = useState("");
  const path = `/tienda/${encodeURIComponent(business.slug)}`;
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = origin ? `${origin}${path}` : "";
  return <section className={`panel ${styles.merchantCard}`} aria-label="Tu tienda online">
    <div className={styles.cardHeading}>
      <div className={styles.merchantCardTitle}><span className={styles.merchantIcon}><Store size={28} aria-hidden="true" /></span><div><span className="eyebrow">TU TIENDA ONLINE</span><h2>{business.active ? "Tu tienda está online" : "Tu tienda está inactiva"}</h2></div></div>
      <span className={`${styles.status} ${!business.active ? styles.inactiveStatus : ""}`}>{business.active && <Check size={14} aria-hidden="true" />}{business.active ? "Online" : "Inactiva"}</span>
    </div>
    <p className={styles.cardDescription}>Un lugar para tu comercio. Compartilo con tus clientes.</p>
    <div className={styles.linkBox}><Link2 size={20} aria-hidden="true" /><div className={styles.linkContent}><span className={styles.linkLabel}>Dirección de tu tienda</span><p className={styles.storeUrl}><span>{origin.replace(/^https?:\/\//, "")}/tienda/</span><strong>{business.slug}</strong></p><StoreSlugEditor key={`${business.id}:${business.slug}`} businessId={business.id} slug={business.slug} origin={origin} onSaved={slug => { updateSlug(business.id, slug); setNotice("Dirección actualizada. Recordá descargar tu nuevo QR si utilizás uno en tu comercio."); }} /></div></div>
    {notice && <p className="info-note" role="status">{notice}</p>}
    {business.active ? <>
      <div className={styles.merchantLinks}><Link className="primary-button" href={path} target="_blank" rel="noopener noreferrer">Ver mi tienda<ArrowUpRight size={17} aria-hidden="true" /></Link><Link className="secondary-link" href="/comercio/mi-negocio#mi-tienda"><Paintbrush size={17} aria-hidden="true" />Personalizar mi tienda</Link></div>
      <div className={styles.shareArea} id="compartir-tienda"><p>Compartila con tus clientes</p><div className={styles.secondaryActions}><StoreShare key={business.slug} name={business.name} slug={business.slug} showCopy onShared={markShared} /><div className={styles.qrAction}><StoreQr key={business.slug} name={business.name} slug={business.slug} url={url} onShared={markShared} /></div></div></div>
      <p className={styles.cardNote}>Los cambios en tu catálogo se reflejan automáticamente en tu tienda.</p>
    </> : <p className="info-note">La página pública estará disponible cuando el comercio esté activo.</p>}
  </section>;
}

"use client";

import { useEffect, useState } from "react";
import { Eye, MapPin, Store } from "lucide-react";
import type { BusinessRow } from "@/types/database";
import { storeAssetPath, type StoreAssetChange, type StoreAssetKind, type StoreBranding } from "@/lib/business-assets";
import styles from "./merchant-store.module.css";

// Only creates local preview URLs; preparing and saving images stays in the existing flow.
function usePreviewUrl(change: StoreAssetChange, savedUrl: string | null, businessId: string, kind: StoreAssetKind) {
  const blob = change.kind === "upload" ? change.photo.blob : null;
  const [local, setLocal] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setLocal({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  if (change.kind === "upload") return local && local.blob === blob ? local.url : null;
  return change.kind === "keep" && storeAssetPath(savedUrl, businessId, kind) ? savedUrl : null;
}

function PreviewImage({ url, kind, name }: { url: string | null; kind: StoreAssetKind; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <div className={kind === "cover" ? styles.previewCover : styles.previewLogo}>
    {url && failedUrl !== url ? /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url} alt={`${kind === "cover" ? "Portada" : "Logo"} de ${name}`} onError={() => setFailedUrl(url)} referrerPolicy="no-referrer" />
      : kind === "cover" ? <div className={styles.previewCoverFallback}><span>Tu comercio.<br />Cerca de vos.</span><Store size={48} aria-hidden="true" /></div> : <Store size={32} aria-hidden="true" />}
  </div>;
}

export function StoreBrandingPreview({ business, previous, changes, description }: {
  business: Pick<BusinessRow, "id" | "name" | "city">;
  previous: StoreBranding;
  changes: Record<StoreAssetKind, StoreAssetChange>;
  description: string;
}) {
  const logo = usePreviewUrl(changes.logo, previous.logo_url, business.id, "logo");
  const cover = usePreviewUrl(changes.cover, previous.cover_url, business.id, "cover");

  return <aside className={styles.previewPanel} aria-label="Vista previa de tu tienda">
    <div className={styles.previewHeading}><span><Eye size={18} aria-hidden="true" />Así se verá tu tienda</span><p>Una vista previa con tus cambios.</p></div>
    <div className={styles.previewFrame}>
      <div className={styles.previewBar} aria-hidden="true"><span /><span /><span /><strong>CercaYa</strong></div>
      <PreviewImage url={cover} kind="cover" name={business.name} />
      <div className={styles.previewBody}>
        <PreviewImage url={logo} kind="logo" name={business.name} />
        <span className={styles.previewLabel}><Store size={14} aria-hidden="true" />TIENDA EN CERCAYA</span>
        <h3>{business.name}</h3>
        {business.city && <p className={styles.previewCity}><MapPin size={15} aria-hidden="true" />{business.city}</p>}
        {description.trim() && <p className={styles.previewDescription}>{description.trim()}</p>}
      </div>
    </div>
    <p className={styles.previewNote}>Revisá cómo queda antes de guardar. Esta vista previa todavía no publica tus cambios.</p>
  </aside>;
}

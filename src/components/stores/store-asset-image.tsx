"use client";

import { useState } from "react";
import { Store } from "lucide-react";
import { storeAssetPath, type StoreAssetKind } from "@/lib/business-assets";
import styles from "./store.module.css";

export function StoreAssetImage({ url, businessId, kind, name }: { url: string | null; businessId: string; kind: StoreAssetKind; name: string }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usable = url && failedUrl !== url && storeAssetPath(url, businessId, kind);
  return <div className={kind === "logo" ? styles.logo : styles.cover}>
    {usable ? /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url ?? undefined} alt={kind === "logo" ? `Logo de ${name}` : `Portada de ${name}`} onError={() => setFailedUrl(url)} referrerPolicy="no-referrer" />
      : kind === "logo" ? <Store size={42} aria-hidden="true" /> : <div className={styles.coverFallback} aria-hidden="true"><span>Tu comercio. Cerca de vos.</span><Store size={76} /></div>}
  </div>;
}

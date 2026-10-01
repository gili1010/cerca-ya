"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Store } from "lucide-react";
import { compressPhoto } from "@/lib/merchant-products/compress-photo";
import { storeAssetPath, type StoreAssetChange, type StoreAssetKind } from "@/lib/business-assets";
import { FormError } from "../requests/request-common";
import styles from "./store.module.css";

export function StoreAssetInput({ kind, businessId, initialUrl, change, onChange, busy, processing, onProcessing }: {
  kind: StoreAssetKind; businessId: string; initialUrl: string | null; change: StoreAssetChange;
  onChange: (change: StoreAssetChange) => void; busy: boolean; processing: boolean; onProcessing: (value: boolean) => void;
}) {
  const label = kind === "logo" ? "Logo" : "Portada";
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const running = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const blob = change.kind === "upload" ? change.photo.blob : null;
  useEffect(() => {
    if (!blob) { setPreview(null); return; }
    const url = URL.createObjectURL(blob); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  const displayed = change.kind === "upload" ? preview : change.kind === "keep" && storeAssetPath(initialUrl, businessId, kind) ? initialUrl : null;

  async function select(file?: File) {
    if (!file || running.current || busy || processing) return;
    running.current = true; onProcessing(true); setError("");
    try {
      const photo = await compressPhoto(file, kind === "logo" ? { edges: [640, 512, 400], targetSize: 180 * 1024 } : { edges: [1800, 1500, 1200], targetSize: 650 * 1024 });
      if (live.current) onChange({ kind: "upload", photo });
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : "No pudimos procesar la imagen."); }
    finally { running.current = false; if (live.current) onProcessing(false); }
  }

  return <section className={styles.assetInput} aria-label={label}>
    <div className={styles.assetInputHeading}><h3>{label}</h3><span>Opcional</span></div>
    <div className={kind === "logo" ? styles.logoPreview : styles.coverPreview}>
      {displayed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={displayed} alt={`Vista previa: ${label.toLowerCase()}`} /> : kind === "logo" ? <Store size={38} aria-hidden="true" /> : <ImagePlus size={36} aria-hidden="true" />}
    </div>
    <label className={styles.fileLabel}>{initialUrl || change.kind === "upload" ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || processing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void select(file); }} /></label>
    <small>JPEG, PNG o WebP · original hasta 10 MB. {kind === "logo" ? "Hasta 640 px; ideal una imagen cuadrada." : "Hasta 1800 px; ideal una imagen horizontal."} Se optimiza antes de subir.</small>
    {blob && <small>Lista para subir: {Math.round(blob.size / 1024)} KB.</small>}
    {processing && <p role="status">Procesando imagen…</p>}
    {change.kind === "remove" && <p className="info-note">Se eliminará al guardar la tienda.</p>}
    <div className={styles.assetActions}>
      {(displayed || change.kind === "upload") && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => onChange(initialUrl ? { kind: "remove" } : { kind: "keep" })}>Eliminar {label.toLowerCase()}</button>}
      {change.kind !== "keep" && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => onChange({ kind: "keep" })}>Deshacer</button>}
    </div>
    <FormError message={error} />
  </section>;
}

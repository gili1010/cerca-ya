"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Store } from "lucide-react";
import { prepareStoreImage, type StoreImageFit } from "@/lib/store-images";
import { storeAssetPath, type StoreAssetChange, type StoreAssetKind } from "@/lib/business-assets";
import { FormError } from "../requests/request-common";
import styles from "./merchant-store.module.css";

export function StoreAssetInput({ kind, businessId, initialUrl, change, onChange, busy, processing, onProcessing }: {
  kind: StoreAssetKind; businessId: string; initialUrl: string | null; change: StoreAssetChange;
  onChange: (change: StoreAssetChange) => void; busy: boolean; processing: boolean; onProcessing: (value: boolean) => void;
}) {
  const label = kind === "logo" ? "Logo" : "Portada";
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [fit, setFit] = useState<StoreImageFit>("contain");
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

  async function select(file?: File, nextFit: StoreImageFit = fit) {
    if (!file || running.current || busy || processing) return;
    running.current = true; onProcessing(true); setError("");
    try {
      const photo = await prepareStoreImage(file, kind, nextFit);
      if (live.current) { setSourceFile(file); setFit(nextFit); onChange({ kind: "upload", photo }); }
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : "No pudimos procesar la imagen."); }
    finally { running.current = false; if (live.current) onProcessing(false); }
  }

  return <section className={styles.assetInput} aria-label={label}>
    <div className={styles.assetInputHeading}><div><h3>{kind === "logo" ? "Logo de tu comercio" : "Portada de tu tienda"}</h3><p>{kind === "logo" ? "Una imagen que tus clientes reconozcan." : "La primera impresión de tu comercio."}</p></div><span>Opcional</span></div>
    <div className={kind === "logo" ? styles.logoPreview : styles.coverPreview}>
      {displayed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={displayed} alt={`Vista previa: ${label.toLowerCase()}`} /> : kind === "logo" ? <Store size={38} aria-hidden="true" /> : <ImagePlus size={36} aria-hidden="true" />}
    </div>
    <label className={styles.fileLabel}>{initialUrl || change.kind === "upload" ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || processing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void select(file, "contain"); }} /></label>
    <small className={styles.recommendation}>{kind === "logo" ? "Recomendado: imagen cuadrada. Se muestra completa, sin recortes." : "Recomendado: imagen horizontal. Por defecto se muestra completa."}</small>
    {kind === "cover" && change.kind === "upload" && sourceFile && <label className={styles.fitLabel}>¿Cómo querés mostrarla?
      <select value={fit} disabled={busy || processing} onChange={event => { const nextFit = event.target.value as StoreImageFit; void select(sourceFile, nextFit); }}>
        <option value="contain">Mostrar completa</option>
        <option value="cover">Rellenar y recortar</option>
      </select>
      <small>{fit === "cover" ? "Recortamos desde el centro. Revisá cómo queda antes de guardar." : "Conservamos toda la imagen y agregamos margen si hace falta."}</small>
    </label>}
    {kind === "cover" && initialUrl && change.kind === "keep" && <small>Para ajustar esta portada, volvé a elegir la imagen original.</small>}
    <small>JPG, PNG o WebP · hasta 10 MB.</small>
    {blob && <small className={styles.readyNote}>Imagen lista para guardar.</small>}
    {processing && <p role="status">Procesando imagen…</p>}
    {change.kind === "remove" && <p className="info-note">Se eliminará al guardar la tienda.</p>}
    <div className={styles.assetActions}>
      {(displayed || change.kind === "upload") && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => { setSourceFile(null); setFit("contain"); onChange(initialUrl ? { kind: "remove" } : { kind: "keep" }); }}>Eliminar {label.toLowerCase()}</button>}
      {change.kind !== "keep" && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => { setSourceFile(null); setFit("contain"); onChange({ kind: "keep" }); }}>Deshacer</button>}
    </div>
    <FormError message={error} />
  </section>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Store } from "lucide-react";
import { prepareStoreImage, type StoreImageFit } from "@/lib/store-images";
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
    <div className={styles.assetInputHeading}><h3>{label}</h3><span>Opcional</span></div>
    <div className={kind === "logo" ? styles.logoPreview : styles.coverPreview}>
      {displayed ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={displayed} alt={`Vista previa: ${label.toLowerCase()}`} /> : kind === "logo" ? <Store size={38} aria-hidden="true" /> : <ImagePlus size={36} aria-hidden="true" />}
    </div>
    <label className={styles.fileLabel}>{initialUrl || change.kind === "upload" ? `Cambiar ${label.toLowerCase()}` : `Subir ${label.toLowerCase()}`}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || processing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void select(file, "contain"); }} /></label>
    <small>{kind === "logo" ? "Recomendado: una imagen cuadrada. También podés usar una foto horizontal o vertical: se muestra completa, centrada y con margen blanco." : "Recomendado: una imagen horizontal. No necesitás medidas exactas: por defecto mostramos toda la imagen, sin cortar texto ni personas."}</small>
    {kind === "cover" && change.kind === "upload" && sourceFile && <label className={styles.fitLabel}>Ajuste de portada
      <select value={fit} disabled={busy || processing} onChange={event => { const nextFit = event.target.value as StoreImageFit; void select(sourceFile, nextFit); }}>
        <option value="contain">Mostrar completa</option>
        <option value="cover">Rellenar y recortar</option>
      </select>
      <small>{fit === "cover" ? "El recorte se centra en la imagen. Revisá la vista previa antes de guardar." : "Si la proporción es distinta, agregamos espacio blanco alrededor para conservar la imagen completa."}</small>
    </label>}
    {kind === "cover" && initialUrl && change.kind === "keep" && <small>Para cambiar el ajuste de una portada guardada, volvé a seleccionar la imagen original.</small>}
    <small>JPEG, PNG o WebP · hasta 10 MB. La imagen se optimiza antes de subir. La vista previa muestra el resultado que se guardará.</small>
    {blob && <small>Lista para subir: {Math.round(blob.size / 1024)} KB.</small>}
    {processing && <p role="status">Procesando imagen…</p>}
    {change.kind === "remove" && <p className="info-note">Se eliminará al guardar la tienda.</p>}
    <div className={styles.assetActions}>
      {(displayed || change.kind === "upload") && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => { setSourceFile(null); setFit("contain"); onChange(initialUrl ? { kind: "remove" } : { kind: "keep" }); }}>Eliminar {label.toLowerCase()}</button>}
      {change.kind !== "keep" && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => { setSourceFile(null); setFit("contain"); onChange({ kind: "keep" }); }}>Deshacer</button>}
    </div>
    <FormError message={error} />
  </section>;
}

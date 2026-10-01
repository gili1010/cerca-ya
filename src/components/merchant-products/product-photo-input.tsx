"use client";

import { useEffect, useRef, useState } from "react";
import { compressProductPhoto } from "@/lib/merchant-products/compress-photo";
import type { MainPhoto, PhotoChange } from "@/lib/merchant-products/photo-storage";
import { ProductImage } from "../details/product-image";
import { FormError } from "../requests/request-common";

export function ProductPhotoInput({ initialImage, change, onChange, busy, processing, onProcessing }: {
  initialImage: MainPhoto | null; change: PhotoChange; onChange: (change: PhotoChange) => void;
  busy: boolean; processing: boolean; onProcessing: (processing: boolean) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const running = useRef(false);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const blob = change.kind === "upload" ? change.photo.blob : null;
  useEffect(() => {
    if (!blob) { setPreview(null); return; }
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  async function select(file?: File) {
    if (!file || running.current || busy) return;
    running.current = true; onProcessing(true); setError("");
    try {
      const photo = await compressProductPhoto(file);
      if (live.current) onChange({ kind: "upload", photo });
    } catch (cause) { if (live.current) setError(cause instanceof Error ? cause.message : "No pudimos procesar la imagen."); }
    finally { running.current = false; if (live.current) onProcessing(false); }
  }
  const displayed = change.kind === "upload" ? preview : change.kind === "keep" ? initialImage?.url : null;
  return <section className="product-photo-input" aria-label="Foto del producto">
    <label>Foto del producto<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || processing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void select(file); }} /></label>
    <small>Una foto · JPEG, PNG o WebP · original de hasta 10 MB. Se comprime antes de subir.</small>
    {displayed && <ProductImage key={displayed} src={displayed} alt="Vista previa de la foto del producto" className="product-photo-preview" />}
    {blob && <small>Foto preparada: {Math.round(blob.size / 1024)} KB. Se sube al guardar.</small>}
    {processing && <p role="status">Procesando imagen...</p>}
    {change.kind === "remove" && <p className="info-note">La foto se eliminará al guardar.</p>}
    {(displayed || change.kind === "upload") && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => { setError(""); onChange(initialImage ? { kind: "remove" } : { kind: "keep" }); }}>Eliminar foto</button>}
    {change.kind !== "keep" && <button className="secondary-link" type="button" disabled={busy || processing} onClick={() => { setError(""); onChange({ kind: "keep" }); }}>Deshacer cambio de foto</button>}
    <FormError message={error} />
  </section>;
}

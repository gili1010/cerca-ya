"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import type { PreparedPhoto } from "@/lib/merchant-products/compress-photo";
import { ProductImage } from "@/components/details/product-image";
import { placeholderImage } from "@/lib/public-catalog";
import { useSignedPersonalPhotos } from "./use-signed-photos";
import flow from "@/components/publish/publish-flow.module.css";
import styles from "./personal-listings.module.css";

export interface ArticlePhotoDraft { key: string; path: string | null; localUrl: string | null; photo: PreparedPhoto | null }
export function ArticlePhotos({ photos, disabled, preparing, onAdd, onChange }: {
  photos: ArticlePhotoDraft[]; disabled: boolean; preparing: boolean;
  onAdd: (files: File[]) => void; onChange: (photos: ArticlePhotoDraft[]) => void;
}) {
  const signed = useSignedPersonalPhotos(photos.flatMap(photo => photo.path ? [photo.path] : []));
  function move(index: number, target: number) {
    const next = [...photos]; const [photo] = next.splice(index, 1); next.splice(target, 0, photo); onChange(next);
  }
  return <div className={flow.photoEditor}><p className={styles.hint}>De una a cinco fotos. La primera será la principal. Mostrá el artículo completo y sus detalles.</p>
    <div className={styles.photoGrid}>{photos.map((photo, index) => <article className={styles.photoTile} key={photo.key}>
      <div><ProductImage src={photo.localUrl ?? (photo.path ? signed.urls[photo.path] : null) ?? placeholderImage} alt={`Foto ${index + 1} del artículo`} /><span className={styles.photoNumber}>{index === 0 ? "Principal" : `Foto ${index + 1}`}</span></div>
      <div className={styles.photoTools}><button type="button" disabled={disabled || index === 0} onClick={() => move(index, index - 1)} aria-label={`Mover foto ${index + 1} antes`}><ArrowLeft size={17} /></button>
        <button type="button" disabled={disabled || index === photos.length - 1} onClick={() => move(index, index + 1)} aria-label={`Mover foto ${index + 1} después`}><ArrowRight size={17} /></button>
        <button type="button" disabled={disabled || index === 0} onClick={() => move(index, 0)} aria-label={`Usar foto ${index + 1} como principal`}><Star size={17} /></button>
        <button type="button" disabled={disabled} onClick={() => onChange(photos.filter(item => item.key !== photo.key))} aria-label={`Eliminar foto ${index + 1}`}><Trash2 size={17} /></button></div>
    </article>)}</div>
    {photos.length < 5 && <label className={styles.upload}><ImagePlus size={26} aria-hidden="true" /><strong>{preparing ? "Preparando fotos…" : "Agregar fotos"}</strong><small>JPEG, PNG o WebP. Revisá las miniaturas antes de continuar.</small>
      <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) onAdd(files); }} /></label>}
    {signed.error && <p className={styles.hint}>{signed.error} <button className="secondary-link" type="button" onClick={signed.refresh}>Volver a cargar fotos</button></p>}
    <p className={styles.hint}>Podés mover las fotos con las flechas o elegir la principal con la estrella. Se guardan al continuar o guardar el borrador.</p></div>;
}

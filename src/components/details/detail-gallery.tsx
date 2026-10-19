"use client";

import { useRef, useState } from "react";
import { ImageOff, Maximize2 } from "lucide-react";
import { Dialog } from "@/components/home/dialog";
import { ProductImage } from "./product-image";
import styles from "./public-details.module.css";

export interface DetailPhoto { id: string; src?: string }

/** Receives resolved URLs only; signing and renewal remain with each domain. */
export function DetailGallery({ photos, title }: { photos: DetailPhoto[]; title: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const index = Math.max(0, photos.findIndex(photo => photo.id === selected));
  const photo = photos[index];
  const image = photo?.src ? <ProductImage src={photo.src} alt={`${title}, foto ${index + 1}`} /> : <span className={styles.placeholder}><ImageOff size={32} aria-hidden="true" />{photos.length ? "Foto no disponible" : "Sin fotografías"}</span>;
  function close() { setExpanded(false); opener.current?.focus(); }
  return <section className={styles.gallery} aria-label={`Fotografías de ${title}`}>
    <button ref={opener} type="button" className={styles.frame} disabled={!photo?.src} onClick={() => setExpanded(true)} aria-label={`Ampliar foto ${index + 1} de ${title}`}>
      {image}{photo?.src && <span className={styles.enlarge}><Maximize2 size={16} aria-hidden="true" />Ampliar</span>}
    </button>
    {photos.length > 1 && <div className={styles.thumbnails} aria-label="Elegir fotografía">{photos.map((item, position) => <button key={item.id} type="button" aria-label={`Ver foto ${position + 1}`} aria-pressed={position === index} onClick={() => setSelected(item.id)}>{item.src ? <ProductImage src={item.src} alt="" /> : <ImageOff size={20} aria-hidden="true" />}</button>)}</div>}
    {expanded && <Dialog title={`Fotografías de ${title}`} onClose={close} className={styles.viewer}>
      <h2>{title}</h2><div className={styles.expandedFrame}>{image}</div>
      {photos.length > 1 && <div className={styles.galleryControls}><button className="outline-button" type="button" disabled={index === 0} onClick={() => setSelected(photos[index - 1].id)}>Anterior</button><span role="status">{index + 1} / {photos.length}</span><button className="outline-button" type="button" disabled={index === photos.length - 1} onClick={() => setSelected(photos[index + 1].id)}>Siguiente</button></div>}
    </Dialog>}
  </section>;
}

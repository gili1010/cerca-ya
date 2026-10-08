"use client";

import { useId, useRef, useState } from "react";
import { Copy, Download, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { createStoreQrPoster } from "@/lib/store-qr-poster";
import { Brand } from "../home/brand";
import { Dialog } from "../home/dialog";
import styles from "./store-qr.module.css";

interface StoreQrProps { name: string; slug: string; url: string; onShared?: () => Promise<string | undefined> }

export function StoreQr({ name, slug, url, onShared }: StoreQrProps) {
  const [open, setOpen] = useState(false);
  return <>
    <button className={`outline-button ${styles.launcher}`} type="button" disabled={!url} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <QrCode size={18} aria-hidden="true" />Mostrar QR
    </button>
    {open && url && <StoreQrDialog key={url} name={name} slug={slug} url={url} onShared={onShared} onClose={() => setOpen(false)} />}
  </>;
}

function StoreQrDialog({ name, slug, url, onClose, onShared }: StoreQrProps & { onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const copying = useRef(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualCopy, setManualCopy] = useState(false);
  const descriptionId = useId();

  async function copyLink() {
    if (copying.current) return;
    copying.current = true; setBusy(true); setNotice(""); setManualCopy(false);
    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(url);
      const progressNotice = await onShared?.();
      setNotice(`Enlace copiado${progressNotice ? `. ${progressNotice}` : ""}`);
    } catch {
      setNotice("No pudimos copiar automáticamente. Seleccioná el enlace y copialo.");
      setManualCopy(true);
    } finally { copying.current = false; setBusy(false); }
  }

  async function downloadPoster() {
    setNotice("");
    try {
      if (!canvas.current) throw new Error("qr_unavailable");
      const link = document.createElement("a");
      const poster = createStoreQrPoster({ qrCanvas: canvas.current, name, url });
      link.href = poster.toDataURL("image/png");
      link.download = `cercaya-tienda-${slug}.png`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      const progressNotice = await onShared?.();
      setNotice(`Descarga del cartel iniciada${progressNotice ? `. ${progressNotice}` : ""}`);
    } catch {
      setNotice("No pudimos descargar el cartel. Cerrá esta ventana y volvé a intentar.");
    }
  }

  return <Dialog title={`QR de la tienda ${name}`} onClose={onClose}>
    <div className={`dialog-body ${styles.content}`}>
      <div className={styles.brand}><Brand /><p>Encontralo cerca. Tenelo hoy.</p></div>
      <div className={styles.heading}>
        <span className={`eyebrow ${styles.label}`}>TU TIENDA EN CERCAYA</span>
        <h2>{name}</h2>
        <p className={styles.message}>Encontrame en CercaYa</p>
        <p id={descriptionId} className={styles.description}>Escaneá para ver mis productos, precios y disponibilidad.</p>
      </div>
      <div className={styles.qr}>
        <QRCodeCanvas ref={canvas} value={url} size={512} level="M" marginSize={4} bgColor="#FFFFFF" fgColor="#000000"
          style={{ width: "100%", height: "auto" }} role="img" aria-label={`Código QR para visitar la tienda ${name}`} aria-describedby={descriptionId} />
      </div>
      <div className={styles.link}><span>El enlace de tu tienda</span><p className={styles.url} title={url}>{url}</p></div>
      <div className={styles.actions}>
        <button className="primary-button" type="button" onClick={() => void downloadPoster()}><Download size={18} aria-hidden="true" />Descargar cartel QR</button>
        <button className="outline-button" type="button" disabled={busy} onClick={() => void copyLink()}><Copy size={17} aria-hidden="true" />Copiar enlace</button>
      </div>
      <p className={styles.downloadHint}>PNG de alta resolución · Para compartir o imprimir</p>
      <p className={styles.notice} role="status">{notice}</p>
      {manualCopy && <input className={styles.manualLink} aria-label="Enlace de la tienda para copiar" readOnly value={url} onFocus={event => event.currentTarget.select()} />}
    </div>
  </Dialog>;
}

"use client";

import { useId, useRef, useState } from "react";
import { Copy, Download, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Dialog } from "../home/dialog";
import styles from "./store-qr.module.css";

interface StoreQrProps { name: string; slug: string; url: string }

export function StoreQr({ name, slug, url }: StoreQrProps) {
  const [open, setOpen] = useState(false);
  return <>
    <button className={`outline-button ${styles.launcher}`} type="button" disabled={!url} aria-haspopup="dialog" onClick={() => setOpen(true)}>
      <QrCode size={18} aria-hidden="true" />Mostrar QR
    </button>
    {open && url && <StoreQrDialog key={url} name={name} slug={slug} url={url} onClose={() => setOpen(false)} />}
  </>;
}

function StoreQrDialog({ name, slug, url, onClose }: StoreQrProps & { onClose: () => void }) {
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
      setNotice("Enlace copiado");
    } catch {
      setNotice("No pudimos copiar automáticamente. Seleccioná el enlace y copialo.");
      setManualCopy(true);
    } finally { copying.current = false; setBusy(false); }
  }

  function downloadQr() {
    setNotice("");
    try {
      if (!canvas.current) throw new Error("qr_unavailable");
      const link = document.createElement("a");
      link.href = canvas.current.toDataURL("image/png");
      link.download = `cercaya-${slug}.png`;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); }
      setNotice("Descarga iniciada");
    } catch {
      setNotice("No pudimos descargar el QR. Cerrá esta ventana y volvé a intentar.");
    }
  }

  return <Dialog title={`QR de la tienda ${name}`} onClose={onClose}>
    <div className={`dialog-body ${styles.content}`}>
      <span className={`eyebrow ${styles.label}`}><QrCode size={16} aria-hidden="true" />TU TIENDA EN CERCAYA</span>
      <h2>{name}</h2>
      <p id={descriptionId}>Escaneá para visitar nuestra tienda en CercaYa</p>
      <div className={styles.qr}>
        <QRCodeCanvas ref={canvas} value={url} size={512} level="M" marginSize={4} bgColor="#FFFFFF" fgColor="#000000"
          style={{ width: "100%", height: "auto" }} role="img" aria-label={`Código QR para visitar la tienda ${name}`} aria-describedby={descriptionId} />
      </div>
      <p className={styles.url}>{url}</p>
      <div className={styles.actions}>
        <button className="outline-button" type="button" disabled={busy} onClick={() => void copyLink()}><Copy size={17} aria-hidden="true" />Copiar enlace</button>
        <button className="primary-button" type="button" onClick={downloadQr}><Download size={17} aria-hidden="true" />Descargar QR</button>
      </div>
      <p className={styles.notice} role="status">{notice}</p>
      {manualCopy && <input className={styles.manualLink} aria-label="Enlace de la tienda para copiar" readOnly value={url} onFocus={event => event.currentTarget.select()} />}
    </div>
  </Dialog>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import styles from "./store.module.css";

export function StoreShare({ name, slug, showCopy = false }: { name: string; slug: string; showCopy?: boolean }) {
  const [canShare, setCanShare] = useState(false);
  const [notice, setNotice] = useState("");
  const [manualUrl, setManualUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);

  async function perform(copyOnly = false) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setNotice(""); setManualUrl("");
    const url = new URL(`/tienda/${encodeURIComponent(slug)}`, window.location.origin).toString();
    try {
      if (!copyOnly && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: `${name} en CercaYa`, text: `Mirá la tienda de ${name} en CercaYa`, url });
          return;
        } catch (cause) {
          if (cause instanceof Error && cause.name === "AbortError") return;
          // Unsupported/failed native sharing can still fall back to copying.
        }
      }
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("Enlace copiado");
    } catch {
      setNotice("No pudimos copiar automáticamente. Seleccioná el enlace y copialo.");
      setManualUrl(url);
    } finally { pending.current = false; setBusy(false); }
  }

  return <div className={styles.share}>
    <div className={styles.shareButtons}>
      {showCopy && <button className="outline-button" type="button" disabled={busy} onClick={() => void perform(true)}><Copy size={17} aria-hidden="true" />Copiar enlace</button>}
      <button className="outline-button" type="button" disabled={busy} onClick={() => void perform()}>{canShare ? <Share2 size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}{canShare || showCopy ? "Compartir tienda" : "Copiar enlace"}</button>
    </div>
    {notice && <p className={styles.shareNotice} role="status">{notice}</p>}
    {manualUrl && <input className={styles.manualLink} aria-label="Enlace de la tienda para copiar" readOnly value={manualUrl} onFocus={event => event.currentTarget.select()} />}
  </div>;
}

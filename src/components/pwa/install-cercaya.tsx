"use client";

import { useState } from "react";
import Image from "next/image";
import { Download, Share } from "lucide-react";
import { Dialog } from "../home/dialog";
import { usePwa } from "./pwa-provider";
import styles from "./pwa.module.css";

export function InstallCercaYa() {
  const { available, ios, busy, install } = usePwa();
  const [help, setHelp] = useState(false);
  if (!available && !ios) return null;
  return <>
    <button className={`secondary-link ${styles.install}`} type="button" disabled={busy} onClick={() => ios ? setHelp(true) : void install()}><Download size={16} aria-hidden="true" />{busy ? "Preparando instalación…" : "Instalar CercaYa"}</button>
    {help && ios && <Dialog title="Instalá CercaYa" onClose={() => setHelp(false)}>
      <div className={styles.help}><Image src="/pwa/icon-192.png" alt="" width={56} height={56} unoptimized /><h2>Instalá CercaYa</h2><p>Accedé más rápido desde tu pantalla de inicio.</p><ol><li>Tocá <strong>Compartir</strong> <Share size={16} aria-hidden="true" /> en Safari.</li><li>Elegí <strong>Agregar a pantalla de inicio</strong> y confirmá.</li></ol><button className="primary-button" type="button" onClick={() => setHelp(false)}>Entendido</button></div>
    </Dialog>}
  </>;
}

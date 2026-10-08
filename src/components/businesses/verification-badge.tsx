"use client";
import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Dialog } from "../home/dialog";
import styles from "./verification.module.css";
export function VerificationBadge({ compact = false }: { compact?: boolean }) {
  const [open,setOpen] = useState(false);
  return <><button type="button" className={`${styles.badge} ${compact ? styles.compact : ""}`} aria-label="Verificado: ver explicación" aria-haspopup="dialog" title="Comercio verificado por CercaYa. CercaYa confirmó la existencia de este comercio y su responsable." onClick={() => setOpen(true)}><BadgeCheck size={compact ? 17 : 15} aria-hidden="true" />{!compact && "Verificado"}</button>
    {open && <Dialog title="Comercio verificado por CercaYa" className={styles.dialog} onClose={() => setOpen(false)}><BadgeCheck size={27} aria-hidden="true" /><h2>Comercio verificado por CercaYa</h2><p>CercaYa confirmó la existencia de este comercio y su responsable.</p><button className="outline-button" onClick={() => setOpen(false)}>Entendido</button></Dialog>}
  </>;
}

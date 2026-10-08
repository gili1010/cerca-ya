"use client";
import { useState } from "react";
import { shortOrderId } from "@/lib/admin/phase2-types";
import styles from "./admin.module.css";
export function CopyOrderId({ id }: { id: string }) {
  const [notice, setNotice] = useState("");
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("Identificador copiado."); }
    catch { setNotice("No pudimos copiarlo. Abrí el ID completo y seleccionalo para copiar."); }
  }
  return <div><div className={styles.dialogActions}><button className={styles.button} onClick={() => void copy(shortOrderId(id))}>Copiar número</button><button className={styles.button} onClick={() => void copy(id)}>Copiar ID completo</button></div><details className={styles.muted}><summary>ID completo para soporte</summary><p className={styles.identifier}>{id}</p></details>{notice && <p role="status" className={styles.notice}>{notice}</p>}</div>;
}

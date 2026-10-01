"use client";

import { useRef, useState, type FormEvent } from "react";
import type { BusinessRow } from "@/types/database";
import { cleanupStoreAssets, readStoreBranding, saveStoreBranding, type StoreAssetChange, type StoreAssetKind, type StoreBranding } from "@/lib/business-assets";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMyBusiness } from "../businesses/business-provider";
import { FormError } from "../requests/request-common";
import { StoreAssetInput } from "./store-asset-input";
import styles from "./store.module.css";

export function StoreBrandingEditor({ business }: { business: BusinessRow }) {
  const { refresh } = useMyBusiness();
  const [previous, setPrevious] = useState<StoreBranding>(() => ({ description: business.description, logo_url: business.logo_url ?? null, cover_url: business.cover_url ?? null }));
  const [description, setDescription] = useState(business.description);
  const [changes, setChanges] = useState<Record<StoreAssetKind, StoreAssetChange>>({ logo: { kind: "keep" }, cover: { kind: "keep" } });
  const [processing, setProcessing] = useState({ logo: false, cover: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingCleanup, setPendingCleanup] = useState<string[]>([]);
  const inFlight = useRef(false);
  const disabled = busy || processing.logo || processing.cover;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || processing.logo || processing.cover) return;
    if (description.trim().length > 3000) { setError("La descripción puede tener hasta 3000 caracteres."); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const result = await saveStoreBranding(client, business.id, previous, description, changes);
      const pending = await cleanupStoreAssets(client, business.id, [...pendingCleanup, ...result.pendingCleanup]);
      setPendingCleanup(pending);
      if (!result.success || !result.current) { setError(result.message); return; }
      setPrevious(result.current); setDescription(result.current.description);
      setChanges({ logo: { kind: "keep" }, cover: { kind: "keep" } });
      setNotice(pending.length ? "Tu tienda se guardó. Quedan archivos anteriores pendientes de limpieza." : business.active ? "Tu tienda se guardó. Ya podés verla online." : "La presentación se guardó. Tu comercio sigue inactivo.");
      await refresh().catch(() => {});
    } catch { setError("No pudimos guardar tu tienda. Revisá la conexión y volvé a intentar."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function reload() {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const current = await readStoreBranding(client, business.id);
      setPrevious(current); setDescription(current.description); setChanges({ logo: { kind: "keep" }, cover: { kind: "keep" } });
      setNotice("Datos de la tienda actualizados.");
    } catch { setError("No pudimos cargar la presentación de tu tienda. Revisá la conexión y la configuración."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  async function retryCleanup() {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const pending = await cleanupStoreAssets(client, business.id, pendingCleanup);
      setPendingCleanup(pending);
      setNotice(pending.length ? "La limpieza sigue pendiente. Volvé a intentar en unos momentos." : "Limpieza completada.");
    } catch { setError("No pudimos limpiar los archivos anteriores."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className={styles.editor} id="mi-tienda" aria-labelledby="store-editor-title">
    <div className="workflow-heading"><span className="eyebrow">TU TIENDA ONLINE</span><h2 id="store-editor-title">Mi tienda</h2><p>Dale identidad a tu comercio. Revisá las imágenes antes de guardar; los cambios se publican en tu tienda.</p></div>
    <form className="panel workflow-form" onSubmit={submit} aria-busy={busy}>
      <div className={styles.assetInputs}>
        {(["logo", "cover"] as const).map(kind => <StoreAssetInput key={kind} kind={kind} businessId={business.id} initialUrl={previous[`${kind}_url`]} change={changes[kind]} onChange={change => setChanges(current => ({ ...current, [kind]: change }))} busy={busy} processing={processing[kind]} onProcessing={value => setProcessing(current => ({ ...current, [kind]: value }))} />)}
      </div>
      <label>Presentación del comercio<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={3000} rows={5} disabled={disabled} placeholder="Contá qué vendés y qué hace especial a tu comercio." /><small>Texto plano · {description.length}/3000 caracteres. Es la misma descripción de Mi comercio.</small></label>
      {notice && <p className="info-note" role="status">{notice}</p>}
      <FormError message={error} />
      {pendingCleanup.length > 0 && <button className="outline-button" type="button" disabled={disabled} onClick={() => void retryCleanup()}>Reintentar limpieza de archivos</button>}
      <button className="primary-button" type="submit" disabled={disabled}>{busy ? "Guardando…" : processing.logo || processing.cover ? "Preparando imágenes…" : "Guardar mi tienda"}</button>
      <div><button className="secondary-link" type="button" disabled={disabled} onClick={() => void reload()}>Recargar datos</button><p className={styles.editorNote}>Recargar descarta los cambios sin guardar de esta sección.</p></div>
    </form>
  </section>;
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import { Check, Paintbrush, RotateCcw } from "lucide-react";
import type { BusinessRow } from "@/types/database";
import { cleanupStoreAssets, readStoreBranding, saveStoreBranding, type StoreAssetChange, type StoreAssetKind, type StoreBranding } from "@/lib/business-assets";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMyBusiness } from "../businesses/business-provider";
import { FormError } from "../requests/request-common";
import { StoreAssetInput } from "./store-asset-input";
import { StoreBrandingPreview } from "./store-branding-preview";
import styles from "./merchant-store.module.css";

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
      setNotice(pending.length ? "Tu tienda se guardó. Algunas imágenes anteriores aún no se pudieron eliminar." : business.active ? "¡Tu tienda está actualizada! Los cambios ya se ven online." : "La presentación se guardó. Tu comercio sigue inactivo.");
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
      setNotice("Cargamos la última versión de tu tienda.");
    } catch { setError("No pudimos cargar la presentación de tu tienda. Revisá la conexión y volvé a intentar."); }
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
      setNotice(pending.length ? "No pudimos eliminar todas las imágenes anteriores. Intentá de nuevo en unos momentos." : "Las imágenes anteriores se eliminaron.");
    } catch { setError("No pudimos limpiar los archivos anteriores."); }
    finally { inFlight.current = false; setBusy(false); }
  }

  return <section className={styles.editor} id="mi-tienda" aria-labelledby="store-editor-title">
    <div className={styles.editorHeading}><span className={styles.headingIcon}><Paintbrush size={22} aria-hidden="true" /></span><div><span className="eyebrow">LA IMAGEN DE TU COMERCIO</span><h2 id="store-editor-title">Personalizá tu tienda</h2><p>Hacé que tus clientes te reconozcan desde el primer vistazo.</p></div></div>
    <form className={`workflow-form ${styles.editorForm}`} onSubmit={submit} aria-busy={busy}>
      <div className={styles.editorLayout}>
        <div className={styles.editorFields}>
          <div className={styles.assetInputs}>
            {(["logo", "cover"] as const).map(kind => <StoreAssetInput key={kind} kind={kind} businessId={business.id} initialUrl={previous[`${kind}_url`]} change={changes[kind]} onChange={change => setChanges(current => ({ ...current, [kind]: change }))} busy={busy} processing={processing[kind]} onProcessing={value => setProcessing(current => ({ ...current, [kind]: value }))} />)}
          </div>
          <div className={styles.descriptionField}>
            <label htmlFor="store-description">Contá sobre tu comercio</label>
            <p>Qué vendés y qué hace especial a tu tienda.</p>
            <textarea id="store-description" value={description} onChange={event => setDescription(event.target.value)} maxLength={3000} rows={5} disabled={disabled} placeholder="Contá qué vendés y qué hace especial a tu comercio." />
            <small>{description.length}/3000 caracteres</small>
          </div>
        </div>
        <StoreBrandingPreview business={business} previous={previous} changes={changes} description={description} />
      </div>
      <div className={styles.saveArea}>
        {notice && <p className="info-note" role="status">{notice}</p>}
        <FormError message={error} />
        {pendingCleanup.length > 0 && <button className="outline-button" type="button" disabled={disabled} onClick={() => void retryCleanup()}>Reintentar eliminar imágenes anteriores</button>}
        <div className={styles.saveRow}><button className="primary-button" type="submit" disabled={disabled}><Check size={18} aria-hidden="true" />{busy ? "Guardando…" : processing.logo || processing.cover ? "Preparando imágenes…" : "Guardar mi tienda"}</button><p>Al guardar, los cambios se reflejan en tu tienda.</p></div>
        <div className={styles.reloadRow}><button className="secondary-link" type="button" disabled={disabled} onClick={() => void reload()}><RotateCcw size={15} aria-hidden="true" />Recargar datos</button><p className={styles.editorNote}>Descarta los cambios sin guardar de esta sección.</p></div>
      </div>
    </form>
  </section>;
}

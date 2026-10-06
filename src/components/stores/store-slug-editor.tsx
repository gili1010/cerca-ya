"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link2, Pencil, TriangleAlert } from "lucide-react";
import { changeStoreSlug, checkStoreSlug, normalizeStoreSlug, storeSlugError, storeSlugValidation } from "@/lib/businesses/slug";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Dialog } from "../home/dialog";
import styles from "./store-slug-editor.module.css";

interface StoreSlugEditorProps {
  businessId: string; slug: string; origin: string; onSaved: (slug: string) => void;
}

export function StoreSlugEditor({ businessId, slug, origin, onSaved }: StoreSlugEditorProps) {
  const [editing, setEditing] = useState(false);
  return <>
    <button className={styles.editButton} type="button" aria-expanded={editing} disabled={!origin} onClick={() => setEditing(value => !value)}><Pencil size={14} aria-hidden="true" />Editar dirección</button>
    {editing && <SlugForm businessId={businessId} slug={slug} origin={origin} onSaved={onSaved} onCancel={() => setEditing(false)} />}
  </>;
}

function SlugForm({ businessId, slug: currentSlug, origin, onSaved, onCancel }: StoreSlugEditorProps & { onCancel: () => void }) {
  const [value, setValue] = useState(currentSlug);
  const [check, setCheck] = useState<{ slug: string; state: "checking" | "available" | "taken" | "error" } | null>(null);
  const [revision, setRevision] = useState(0);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const inputId = useId();
  const slug = normalizeStoreSlug(value);
  const validation = storeSlugValidation(slug);
  const prefix = `${origin}/tienda/`;
  const displayPrefix = prefix.replace(/^https?:\/\//, "");
  const available = check?.slug === slug && check.state === "available";
  const changed = slug !== currentSlug;

  useEffect(() => {
    if (validation || !changed) return;
    let live = true;
    setCheck({ slug, state: "checking" });
    const timer = window.setTimeout(() => {
      const client = getSupabaseBrowserClient();
      if (!client) { if (live) setCheck({ slug, state: "error" }); return; }
      checkStoreSlug(client, businessId, slug).then(result => {
        if (live) setCheck({ slug, state: result ? "available" : "taken" });
      }).catch(() => { if (live) setCheck({ slug, state: "error" }); });
    }, 400);
    return () => { live = false; window.clearTimeout(timer); };
  }, [businessId, slug, validation, changed, revision]);

  function requestConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (available && changed && !validation && !pending.current) { setError(""); setConfirming(slug); }
  }

  async function save() {
    if (!confirming || pending.current) return;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos conectar. Volvé a intentar."); return; }
    pending.current = true; setBusy(true); setError("");
    try {
      const { data, error: failure } = await changeStoreSlug(client, businessId, confirming);
      if (failure) {
        setError(storeSlugError(failure));
        if (failure.code === "23505") {
          setCheck({ slug: confirming, state: "taken" });
          setConfirming(null);
        }
        return;
      }
      if (!data) { setError("No pudimos comprobar el cambio. Revisá tu dirección actual antes de volver a intentar."); return; }
      onSaved(data);
      onCancel();
    } catch {
      setError("No pudimos comprobar el cambio. Revisá tu conexión y tu dirección actual antes de volver a intentar.");
    } finally { pending.current = false; setBusy(false); }
  }

  function closeConfirmation() { if (!pending.current) setConfirming(null); }
  const status = validation || (!changed ? "Esta es tu dirección actual." : check?.slug !== slug || check.state === "checking" ? "Comprobando disponibilidad…" : check.state === "available" ? "Esta dirección está disponible." : check.state === "taken" ? "Esta dirección ya está en uso." : "No pudimos comprobar la disponibilidad. Volvé a intentar.");

  return <>
    <form className={styles.form} onSubmit={requestConfirmation}>
      <label htmlFor={inputId}>Dirección de tu tienda</label>
      <div className={styles.addressField}><span className={styles.fixedPrefix}>{displayPrefix}</span><input id={inputId} value={value} onChange={event => { setValue(event.target.value); setError(""); }} onBlur={() => setValue(slug)} autoFocus autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" maxLength={200} aria-describedby={`${inputId}-help ${inputId}-status`} /></div>
      <p id={`${inputId}-help`} className={styles.help}>Entre 3 y 50 caracteres. Letras, números y guiones. Tu nombre de comercio no cambia.</p>
      {changed && !validation && <p className={styles.preview}>Así quedará: <strong>{displayPrefix}{slug}</strong></p>}
      <p id={`${inputId}-status`} className={`${styles.status} ${available && changed ? styles.available : ""}`} role="status">{status}</p>
      {check?.slug === slug && check.state === "error" && <button className={styles.editButton} type="button" onClick={() => setRevision(number => number + 1)}>Volver a comprobar</button>}
      {error && !confirming && <p className="form-error" role="alert">{error}</p>}
      <div className={styles.actions}><button className="outline-button button-sm" type="button" onClick={onCancel}>Cancelar</button><button className="primary-button button-sm" type="submit" disabled={!changed || Boolean(validation) || !available}>Continuar</button></div>
    </form>
    {confirming && <Dialog title="Cambiar dirección de tu tienda" onClose={closeConfirmation} className={styles.confirmationDialog}>
      <div className={styles.confirmation}>
        <header className={styles.confirmationHeading}>
          <span className={styles.headingIcon}><Link2 size={23} aria-hidden="true" /></span>
          <h2>Cambiar dirección de tu tienda</h2>
          <p>Vas a cambiar el enlace público de tu tienda.</p>
        </header>
        <section className={styles.urlPreview} aria-label="Nueva dirección">
          <p className={styles.previewLabel}>Nueva dirección</p>
          <div className={styles.newAddress}><Link2 size={19} aria-hidden="true" /><p>{displayPrefix}<strong>{confirming}</strong></p></div>
        </section>
        <aside className={styles.warning}>
          <TriangleAlert size={21} aria-hidden="true" />
          <div><h3>Importante</h3><p>Los enlaces y códigos QR anteriores dejarán de funcionar.</p><p>Después del cambio vas a tener que volver a compartir tu enlace y actualizar cualquier QR que tengas impreso.</p></div>
        </aside>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className={`${styles.actions} ${styles.confirmationActions}`}><button className="outline-button" type="button" disabled={busy} onClick={closeConfirmation}>Cancelar</button><button className="primary-button" type="button" disabled={busy} onClick={() => void save()}>{busy ? "Cambiando dirección…" : "Cambiar dirección"}</button></footer>
      </div>
    </Dialog>}
  </>;
}

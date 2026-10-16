"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { OwnedPersonalListing, PersonalListingAction } from "@/types/personal-listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { readMyPersonalListing, managePersonalListing } from "@/lib/personal-listings/client";
import { articleUiError } from "@/lib/personal-listings/form";
import { BackLink } from "@/components/navigation/back-link";
import { FormError } from "@/components/requests/request-common";
import { ArticlePresentation } from "./article-presentation";
import { ListingActions, ListingStatus } from "./listing-actions";
import { ListingActionConfirmation } from "./listing-action-confirmation";
import { useSignedPersonalPhotos } from "./use-signed-photos";
import styles from "./personal-listings.module.css";

export function OwnedArticle({ id }: { id: string }) {
  const [listing, setListing] = useState<OwnedPersonalListing | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [suspended, setSuspended] = useState(false), [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<PersonalListingAction | null>(null), [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const lock = useRef(false);
  useEffect(() => {
    let live = true; setLoading(true); setError("");
    const client = getSupabaseBrowserClient();
    if (!client) { setLoading(false); setError("No pudimos cargar el artículo."); return; }
    Promise.all([readMyPersonalListing(client, id), client.rpc("is_my_account_suspended", {})]).then(([row, suspension]) => {
      if (!live) return; if (suspension.error) throw new Error(); setListing(row); setSuspended(Boolean(suspension.data)); setLoading(false);
    }).catch(() => { if (live) { setLoading(false); setError("No pudimos cargar el artículo. Volvé a intentar."); } });
    return () => { live = false; };
  }, [id, attempt]);
  const signed = useSignedPersonalPhotos(loading ? [] : listing?.images.map(photo => photo.object_path) ?? []);
  async function confirm() {
    if (!listing || !action || lock.current) return;
    lock.current = true; setBusy(true); setActionError("");
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("No pudimos guardar el cambio.");
      await managePersonalListing(client, listing.id, listing.revision, action); setAction(null); setAttempt(value => value + 1);
    } catch (cause) { setActionError(articleUiError(cause)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <><BackLink href="/mis-publicaciones">Mis publicaciones</BackLink><div className={styles.heading}><span className="eyebrow">VISTA DEL PROPIETARIO</span><h1>Tu artículo</h1><p>Podés ver tus borradores y anuncios retirados. Esta vista es sólo para tu cuenta.</p></div>
    <FormError message={error} />{loading ? <p role="status" className="workflow-loading">Cargando artículo…</p> : error ? <button className="outline-button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button> : !listing ? <section className={`panel ${styles.empty}`}><h2>Esta publicación no está disponible para tu cuenta.</h2><Link className="primary-button" href="/mis-publicaciones">Mis publicaciones</Link></section> : <>
      <div className={styles.actions} style={{ marginBottom: "var(--space-5)" }}><ListingStatus listing={listing} /></div>
      {suspended && <p className="form-error">Tu cuenta está suspendida. Las modificaciones no están disponibles.</p>}
      <ArticlePresentation listing={listing} photoUrls={signed.urls} ownerView />
      <ListingActions listing={listing} suspended={suspended} disabled={busy} onAction={(_row, selected) => { setActionError(""); setAction(selected); }} />
      {signed.error && <p className={styles.hint}>{signed.error} <button className="secondary-link" onClick={signed.refresh}>Reintentar fotos</button></p>}
    </>}{listing && action && <ListingActionConfirmation listing={listing} action={action} busy={busy} error={actionError} onClose={() => { if (!busy) { setAction(null); if (actionError) setAttempt(value => value + 1); } }} onConfirm={() => void confirm()} />}
  </>;
}

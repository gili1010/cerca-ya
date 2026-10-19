"use client";

import {LoadingState} from "@/components/ui/primitives";
import management from "@/components/management/management.module.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Package, Plus, RefreshCw } from "lucide-react";
import type { OwnedPersonalListing, PersonalListingAction, PersonalListingPage, PersonalListingStatus } from "@/types/personal-listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { readMyPersonalListings, managePersonalListing, readMyPersonalListing } from "@/lib/personal-listings/client";
import { personalArticleMoney, articleUiError } from "@/lib/personal-listings/form";
import { personalListingStatuses } from "@/lib/personal-listings/contracts";
import { ProductImage } from "@/components/details/product-image";
import { placeholderImage } from "@/lib/public-catalog";
import { FormError } from "@/components/requests/request-common";
import { useSignedPersonalPhotos } from "./use-signed-photos";
import { ListingActions, ListingStatus, personalStatusLabels } from "./listing-actions";
import { ListingActionConfirmation } from "./listing-action-confirmation";
import styles from "./personal-listings.module.css";

export function MyListings() {
  const [status, setStatus] = useState<PersonalListingStatus | "">(""); const [page, setPage] = useState(0);
  const [result, setResult] = useState<PersonalListingPage<OwnedPersonalListing> | null>(null);
  const [loading, setLoading] = useState(true), [suspended, setSuspended] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0), [busy, setBusy] = useState(false), [actionError, setActionError] = useState("");
  const [selection, setSelection] = useState<{ listing: OwnedPersonalListing; action: PersonalListingAction } | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    const client = getSupabaseBrowserClient();
    setLoading(true); setError("");
    if (!client) { setLoading(false); setError("No pudimos cargar tus publicaciones."); return; }
    Promise.all([readMyPersonalListings(client, { status: status || null, page }, controller.signal), client.rpc("is_my_account_suspended", {})])
      .then(([data, suspension]) => {
        if (!active) return;
        if (suspension.error) throw new Error();
        const last = Math.max(0, Math.ceil(data.total / data.limit) - 1);
        if (page > last) { setPage(last); return; }
        setResult(data); setSuspended(Boolean(suspension.data)); setLoading(false);
      }).catch(() => { if (active) { setError("No pudimos cargar tus publicaciones. Volvé a intentar."); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [status, page, attempt]);
  const signed = useSignedPersonalPhotos(loading ? [] : result?.items.flatMap(listing => listing.images[0] ? [listing.images[0].object_path] : []) ?? []);
  async function confirm() {
    if (!selection || lock.current) return;
    const current = selection; lock.current = true; setBusy(true); setActionError("");
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("No pudimos guardar el cambio.");
      await managePersonalListing(client, current.listing.id, current.listing.revision, current.action);
      const row = await readMyPersonalListing(client, current.listing.id);
      const expected = { pause: "PAUSED", publish: "PUBLISHED", sold: "SOLD", withdraw: "WITHDRAWN" }[current.action];
      if (!row || row.status !== expected) throw new Error("No pudimos confirmar el cambio. Actualizá el listado para comprobar el estado.");
      setSelection(null); setNotice("Estado de la publicación actualizado."); setAttempt(value => value + 1);
    } catch (cause) {
      setActionError(articleUiError(cause));
    } finally { lock.current = false; setBusy(false); }
  }
  return <div className={management.page}><div className={`${styles.headingRow} ${management.headingRow}`}><div className={styles.heading}><span className="eyebrow">TU ESPACIO COMO PARTICULAR</span><h1>Mis publicaciones</h1><p>Tus artículos, sus fotos y su estado, en un solo lugar.</p></div><Link className="primary-button" href="/publicar/articulo"><Plus size={19} aria-hidden="true" />Publicar artículo</Link></div>
    {suspended && <p className="form-error">Tu cuenta está suspendida. Podés consultar tus anuncios, pero no modificarlos.</p>}
    <div className={styles.toolbar}><label>Estado<select value={status} disabled={busy} onChange={event => { const selected = event.target.value; setStatus(personalListingStatuses.find(value => value === selected) ?? ""); setPage(0); }}><option value="">Todos los estados</option>{personalListingStatuses.map(value => <option value={value} key={value}>{personalStatusLabels[value]}</option>)}</select></label><button className="outline-button" disabled={loading || busy} onClick={() => setAttempt(value => value + 1)}><RefreshCw size={17} aria-hidden="true" />Actualizar</button></div>
    {notice && <p className={styles.notice} role="status">{notice}</p>}<FormError message={error} />
    {loading ? <LoadingState label="Cargando tus publicaciones…"/> : error ? <button className="outline-button" onClick={() => setAttempt(value => value + 1)}>Reintentar</button> : result && <>
      <p className={styles.metadata} style={{ marginBottom: "var(--space-5)" }}>{result.total} {result.total === 1 ? "publicación" : "publicaciones"}</p>
      {result.items.length ? <div className={`${styles.listingGrid} ${management.records}`}>{result.items.map(listing => <article className={styles.listingCard} key={listing.id}><div className={`${styles.cardPhoto} ${management.thumbnail}`}><ProductImage src={listing.images[0] ? signed.urls[listing.images[0].object_path] ?? placeholderImage : placeholderImage} alt={listing.title} /></div><div className={styles.cardBody}><ListingStatus listing={listing} /><h2>{listing.title}</h2><strong className={styles.price}>{personalArticleMoney(listing.price)}</strong><p className={styles.metadata}>{listing.item_condition === "NEW" ? "Nuevo" : "Usado"}</p><p className={styles.metadata}>{listing.city}, {listing.province}</p><p className={styles.metadata}><time dateTime={listing.created_at}>{new Date(listing.created_at).toLocaleDateString("es-AR")}</time></p><ListingActions listing={listing} disabled={busy} suspended={suspended} onAction={(row, action) => { setActionError(""); setSelection({ listing: row, action }); }} /></div></article>)}</div>
        : <section className={`panel ${styles.empty}`}><span className={styles.symbol}><Package size={30} aria-hidden="true" /></span><h2>{status ? "No hay publicaciones en este estado." : "Tu primer artículo empieza acá."}</h2><p>Podés vender algo nuevo o usado sin crear un comercio.</p><Link className="primary-button" href="/publicar/articulo">Publicar mi artículo</Link></section>}
      {result.total > result.limit && <nav className={styles.pagination} aria-label="Páginas de mis publicaciones"><button className="outline-button" disabled={page === 0 || busy} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page + 1} de {Math.ceil(result.total / result.limit)}</span><button className="outline-button" disabled={(page + 1) * result.limit >= result.total || busy} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
    </>}{signed.error && <p className={styles.hint}>{signed.error} <button className="secondary-link" onClick={signed.refresh}>Reintentar fotos</button></p>}
    {selection && <ListingActionConfirmation {...selection} busy={busy} error={actionError} onClose={() => { if (!busy) { setSelection(null); if (actionError) setAttempt(value => value + 1); } }} onConfirm={() => void confirm()} />}
  </div>;
}

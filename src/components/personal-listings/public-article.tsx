"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicPersonalListing } from "@/types/personal-listings";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { readPublicPersonalListing } from "@/lib/personal-listings/client";
import { BackLink } from "@/components/navigation/back-link";
import { FormError } from "@/components/requests/request-common";
import { ArticlePresentation } from "./article-presentation";
import { useSignedPersonalPhotos } from "./use-signed-photos";
import styles from "./personal-listings.module.css";

export function PublicArticle({ initial, returnTo = "/" }: { initial: PublicPersonalListing; returnTo?: string }) {
  const [listing, setListing] = useState<PublicPersonalListing | null>(initial);
  const [error, setError] = useState(""), [checking, setChecking] = useState(false);
  const live = useRef(true), lastChecked = useRef(Date.now()), lock = useRef(false);
  const refresh = useCallback(async () => {
    if (lock.current) return; lock.current = true; setChecking(true);
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error();
      const current = await readPublicPersonalListing(client, initial.id);
      if (live.current) { setListing(current); setError(""); lastChecked.current = Date.now(); }
    } catch {
      // No mantener un contacto potencialmente retirado si ya no se puede validar.
      if (live.current) { setListing(null); setError("No pudimos comprobar si el artículo sigue disponible. Volvé a intentar."); }
    } finally { lock.current = false; if (live.current) setChecking(false); }
  }, [initial.id]);
  useEffect(() => {
    live.current = true;
    const timer = setInterval(() => void refresh(), 540000);
    const focus = () => { if (Date.now() - lastChecked.current >= 540000) void refresh(); };
    const visible = () => { if (document.visibilityState === "visible") focus(); };
    window.addEventListener("focus", focus); document.addEventListener("visibilitychange", visible);
    return () => { live.current = false; clearInterval(timer); window.removeEventListener("focus", focus); document.removeEventListener("visibilitychange", visible); };
  }, [refresh]);
  useEffect(() => {
    if (!listing?.expires_at) return;
    const timer = setTimeout(() => void refresh(), Math.min(2147483647, Math.max(1000, Date.parse(listing.expires_at) - Date.now())));
    return () => clearTimeout(timer);
  }, [listing?.expires_at, refresh]);
  const signed = useSignedPersonalPhotos(listing?.images.map(photo => photo.object_path) ?? []);
  return <><BackLink href={returnTo}>{returnTo === "/" ? "Volver a CercaYa" : "Volver a los resultados"}</BackLink><p className={styles.metadata} style={{ marginBlock: "var(--space-5)" }}>ARTÍCULO PARTICULAR · {listing?.category_name ?? "CercaYa"}</p><FormError message={error} />
    {!listing ? <section className={`panel ${styles.empty}`}><h1>{error ? "Revisemos este artículo" : "Este artículo ya no está disponible."}</h1><p>Puede haber sido vendido, pausado o retirado por su vendedor.</p><button className="outline-button" disabled={checking} onClick={() => void refresh()}>{checking ? "Comprobando…" : "Volver a comprobar"}</button></section>
      : <><ArticlePresentation listing={listing} photoUrls={signed.urls} /><p className={styles.metadata} style={{ marginTop: "var(--space-5)" }}><time dateTime={listing.published_at}>Publicado el {new Date(listing.published_at).toLocaleDateString("es-AR")}</time></p>
        {signed.error && <p className={styles.hint}>{signed.error} <button className="secondary-link" onClick={() => { signed.refresh(); void refresh(); }}>Volver a cargar</button></p>}</>}
  </>;
}

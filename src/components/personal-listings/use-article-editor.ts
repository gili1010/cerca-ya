"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CategoryRow, Database } from "@/types/database";
import type { OwnedPersonalListing } from "@/types/personal-listings";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createPersonalListing, readMyPersonalListing, updatePersonalListing, managePersonalListing } from "@/lib/personal-listings/client";
import { cleanupPersonalListingPhotos, PersonalListingUploadError, preparePersonalListingPhoto, savePersonalListingImages, uploadPersonalListingPhoto } from "@/lib/personal-listings/images";
import { isPersonalListingId, isPersonalListingObjectPath } from "@/lib/personal-listings/contracts";
import { articleFormFromListing, articleInput, articleUiError, emptyArticleForm, listingMatchesInput, validateArticleForm, type PersonalArticleForm } from "@/lib/personal-listings/form";
import type { ArticlePhotoDraft } from "./article-photos";

export type ArticleCategory = Pick<CategoryRow, "id" | "name" | "slug">;
const fromPhotos = (listing: OwnedPersonalListing): ArticlePhotoDraft[] => listing.images.map(image => ({ key: image.object_path, path: image.object_path, localUrl: null, photo: null }));
function stored(key: string): string | null { try { return sessionStorage.getItem(key); } catch { return null; } }
function store(key: string, value: string | null) { try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, value); } catch { /* El borrador real queda en Mis publicaciones. */ } }

export function useArticleEditor(listingId?: string) {
  const { user } = useAuth();
  const [form, setForm] = useState<PersonalArticleForm>(emptyArticleForm);
  const [base, setBase] = useState<OwnedPersonalListing | null>(null);
  const baseRef = useRef<OwnedPersonalListing | null>(null);
  const idRef = useRef<string | null>(listingId ?? null);
  const [photos, setPhotos] = useState<ArticlePhotoDraft[]>([]);
  const [categories, setCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true), [missing, setMissing] = useState(false);
  const [suspended, setSuspended] = useState(false), [busy, setBusy] = useState(false), [preparing, setPreparing] = useState(false);
  const [frozen, setFrozen] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [pendingCleanup, setPendingCleanup] = useState<string[]>([]), [step, setStep] = useState(0), [success, setSuccess] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const operation = useRef(false), live = useRef(true), blobs = useRef(new Set<string>());
  const draftKey = `cercaya:personal-draft:${user?.id ?? ""}`;
  const cleanupKey = useCallback((id: string) => `cercaya:personal-photo-cleanup:${user?.id ?? ""}:${id}`, [user?.id]);
  const terminal = base?.status === "SOLD" || base?.status === "WITHDRAWN";
  const locked = loading || busy || preparing || frozen || suspended || Boolean(base?.admin_blocked) || terminal;

  useEffect(() => {
    live.current = true;
    return () => { live.current = false; for (const url of blobs.current) URL.revokeObjectURL(url); blobs.current.clear(); };
  }, []);

  function adopt(row: OwnedPersonalListing, reset: boolean) {
    baseRef.current = row; idRef.current = row.id; setBase(row);
    if (reset) {
      for (const url of blobs.current) URL.revokeObjectURL(url); blobs.current.clear();
      setForm(articleFormFromListing(row)); setPhotos(fromPhotos(row));
    }
  }
  function rememberCleanup(id: string, paths: string[]) {
    const safe = [...new Set(paths)].filter(path => isPersonalListingObjectPath(path, id)).slice(0, 10);
    setPendingCleanup(safe); store(cleanupKey(id), safe.length ? JSON.stringify(safe) : null);
  }
  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      try {
        const client = getSupabaseBrowserClient(); if (!client) throw new Error();
        const saved = listingId ?? (reloadKey > 0 ? idRef.current : null) ?? stored(draftKey);
        const candidate = saved && isPersonalListingId(saved) ? saved : null;
        const [categoryResult, suspensionResult, row] = await Promise.all([
          client.from("categories").select("id,name,slug").order("name"),
          client.rpc("is_my_account_suspended", {}),
          candidate ? readMyPersonalListing(client, candidate) : Promise.resolve(null),
        ]);
        if (categoryResult.error || suspensionResult.error) throw new Error();
        if (!active) return;
        setCategories(categoryResult.data ?? []); setSuspended(Boolean(suspensionResult.data));
        if (listingId && !row) setMissing(true);
        else if (row && (listingId || row.status === "DRAFT" || reloadKey > 0)) {
          adopt(row, true);
          if (!listingId) setNotice(row.status === "DRAFT" ? "Retomaste tu borrador. También podés empezar otro artículo." : "Recuperamos el estado guardado de tu publicación. Revisalo antes de continuar.");
          try {
            const paths: unknown = JSON.parse(stored(cleanupKey(row.id)) ?? "[]");
            if (Array.isArray(paths)) setPendingCleanup(paths.filter((path): path is string => isPersonalListingObjectPath(path, row.id)).slice(0, 10));
          } catch { /* Ignorar datos de sesión inválidos. */ }
        } else if (row) { store(draftKey, null); idRef.current = null; }
        else if (candidate && !listingId) idRef.current = candidate; // Mantener ID de un alta incierta.
        setError(""); setLoading(false);
      } catch { if (active) { setError("No pudimos cargar el formulario. Volvé a intentar."); setLoading(false); setFrozen(true); } }
    }
    void load();
    return () => { active = false; };
  }, [user?.id, listingId, draftKey, cleanupKey, reloadKey]);

  let dirty = !base && Object.values(form).some(value => typeof value === "string" && value !== "" && value !== "USED");
  if (base) {
    try { dirty = !listingMatchesInput(base, articleInput(form, base)); } catch { dirty = true; }
    dirty ||= photos.some(photo => photo.photo !== null) || photos.map(photo => photo.path).join("|") !== base.images.map(photo => photo.object_path).join("|");
  }
  useEffect(() => {
    if (!dirty && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);

  function change<K extends keyof PersonalArticleForm>(key: K, value: PersonalArticleForm[K]) { setForm(current => ({ ...current, [key]: value })); setNotice(""); }
  function changePhotos(next: ArticlePhotoDraft[]) {
    const kept = new Set(next.flatMap(photo => photo.localUrl ? [photo.localUrl] : []));
    for (const photo of photos) if (photo.localUrl && !kept.has(photo.localUrl)) { URL.revokeObjectURL(photo.localUrl); blobs.current.delete(photo.localUrl); }
    setPhotos(next); setNotice("");
  }
  async function addPhotos(files: File[]) {
    if (locked || operation.current) return;
    if (files.length + photos.length > 5) { setError("Podés agregar hasta cinco fotos en total."); return; }
    operation.current = true; setPreparing(true); setError("");
    const selected: ArticlePhotoDraft[] = [];
    try {
      for (const file of files) {
        const photo = await preparePersonalListingPhoto(file);
        if (!live.current) return;
        const url = URL.createObjectURL(photo.blob); blobs.current.add(url);
        selected.push({ key: crypto.randomUUID(), path: null, localUrl: url, photo });
      }
      setPhotos(current => [...current, ...selected]);
    } catch (cause) {
      for (const photo of selected) if (photo.localUrl) { URL.revokeObjectURL(photo.localUrl); blobs.current.delete(photo.localUrl); }
      setError(articleUiError(cause));
    } finally { operation.current = false; if (live.current) setPreparing(false); }
  }
  async function activeClient(): Promise<SupabaseClient<Database>> {
    const client = getSupabaseBrowserClient(); if (!client || !live.current) throw new Error("No pudimos continuar. Volvé a iniciar sesión.");
    const { data, error: authError } = await client.auth.getUser();
    if (authError || !data.user || data.user.id !== user?.id || !live.current) throw new Error("Tu sesión cambió. Volvé a cargar esta pantalla.");
    return client;
  }
  async function persistInfo(required = false) {
    const validation = validateArticleForm(form, categories.map(category => category.id), required || baseRef.current?.status === "PUBLISHED");
    if (validation) throw new Error(validation);
    const client = await activeClient();
    const previous = baseRef.current;
    const input = articleInput(form, previous);
    if (previous && listingMatchesInput(previous, input)) return previous;
    let row: OwnedPersonalListing | null;
    if (!previous) {
      const id = idRef.current ?? crypto.randomUUID(); idRef.current = id; store(draftKey, id);
      row = await readMyPersonalListing(client, id);
      if (row) {
        // Recuperar también fotos/revisión: no usar una revisión nueva para
        // reemplazar con una selección local vieja de otra pestaña.
        throw new Error("Ya hay una publicación guardada con este intento. Recargá para continuar sin duplicarla.");
      } else { await createPersonalListing(client, input, id); row = await readMyPersonalListing(client, id); }
    } else {
      await updatePersonalListing(client, previous.id, previous.revision, input);
      row = await readMyPersonalListing(client, previous.id);
      if (row?.revision !== previous.revision + 1) throw new Error("La publicación cambió en otra sesión. Recargá antes de guardar nuevamente.");
    }
    if (!live.current || !row || !listingMatchesInput(row, input)) throw new Error("No pudimos comprobar los cambios guardados. Recargá antes de reintentar.");
    adopt(row, false); return row;
  }
  async function persistPhotos(row: OwnedPersonalListing) {
    if (photos.every(photo => photo.path && !photo.photo) && photos.map(photo => photo.path).join("|") === row.images.map(photo => photo.object_path).join("|")) return row;
    const client = await activeClient(); const uploaded: string[] = []; const desired: string[] = [];
    let queued = [...pendingCleanup]; let uncertainCommit = false;
    try {
      for (const photo of photos) {
        if (photo.path) desired.push(photo.path);
        else if (photo.photo) {
          const path = await uploadPersonalListingPhoto(client, row.id, photo.photo); uploaded.push(path); desired.push(path);
        }
        if (!live.current) throw new Error("Tu sesión cambió. Volvé a cargar esta pantalla.");
      }
      const result = await savePersonalListingImages(client, row, desired);
      uncertainCommit = result.uncertain;
      queued = [...queued, ...result.pendingCleanup];
      rememberCleanup(row.id, queued);
      if (!result.success || !result.listing) throw new Error(result.message || "No pudimos comprobar las fotos guardadas. Recargá para continuar.");
      if (result.listing.revision !== row.revision + 1) throw new Error("La publicación cambió en otra sesión. Recargá antes de guardar nuevamente.");
      adopt(result.listing, false);
      for (const url of blobs.current) URL.revokeObjectURL(url); blobs.current.clear();
      setPhotos(fromPhotos(result.listing)); return result.listing;
    } catch (cause) {
      if (cause instanceof PersonalListingUploadError) uploaded.push(cause.objectPath);
      // Si falta confirmar el resultado, conservar las versiones hasta recargar.
      let pending = uploaded;
      if (!uncertainCommit) try { pending = await cleanupPersonalListingPhotos(client, row.id, uploaded); } catch { /* Reintento explícito posterior. */ }
      rememberCleanup(row.id, [...queued, ...pending]);
      throw cause;
    }
  }
  async function perform(task: () => Promise<void>) {
    if (locked || operation.current) return;
    operation.current = true; setBusy(true); setError(""); setNotice("");
    try { await task(); }
    catch (cause) { if (live.current) { setError(articleUiError(cause)); setFrozen(true); } }
    finally { operation.current = false; if (live.current) setBusy(false); }
  }
  function validate(required = false) {
    const validation = validateArticleForm(form, categories.map(category => category.id), required || base?.status === "PUBLISHED");
    if (validation) { setError(validation); return false; }
    return true;
  }
  function save() {
    if (!validate()) return;
    if (base?.status === "PUBLISHED" && !photos.length) { setError("Para quitar la última foto, pausá primero la publicación."); return; }
    void perform(async () => {
      const row = await persistPhotos(await persistInfo());
      setNotice(row.status === "PUBLISHED" ? "Cambios guardados en tu publicación." : row.status === "DRAFT" ? "Borrador guardado. Podés retomarlo desde Mis publicaciones." : "Cambios guardados. La publicación sigue pausada.");
    });
  }
  function next() {
    if (!validate(step >= 2)) return;
    if (step >= 1 && !photos.length) { setError("Agregá al menos una foto para continuar. También podés guardar el borrador sin fotos."); return; }
    void perform(async () => { const row = await persistInfo(step >= 2); if (step >= 1) await persistPhotos(row); setStep(current => Math.min(3, current + 1)); });
  }
  function publish() {
    if (!validate(true)) return;
    if (!photos.length) { setError("Agregá al menos una foto antes de publicar."); return; }
    void perform(async () => {
      const client = await activeClient(); const row = await persistPhotos(await persistInfo(true));
      if (row.expired) throw new Error("La publicación venció. Elegí renovarla antes de publicarla.");
      if (row.status !== "PUBLISHED") await managePersonalListing(client, row.id, row.revision, "publish");
      const confirmed = await readMyPersonalListing(client, row.id);
      if (!confirmed || confirmed.status !== "PUBLISHED" || confirmed.admin_blocked || confirmed.expired) throw new Error("No pudimos confirmar la publicación. Recargá para comprobar su estado.");
      const expectedRevision = row.revision + (row.status === "PUBLISHED" ? 0 : 1);
      if (confirmed.revision !== expectedRevision) throw new Error("La publicación cambió en otra sesión. Recargá para revisar el estado publicado.");
      adopt(confirmed, false); store(draftKey, null); setSuccess(true);
    });
  }
  function pause() {
    void perform(async () => {
      const client = await activeClient(); const row = baseRef.current;
      if (!row) return;
      await managePersonalListing(client, row.id, row.revision, "pause");
      const current = await readMyPersonalListing(client, row.id);
      if (!current || current.status !== "PAUSED" || current.revision !== row.revision + 1) throw new Error("La publicación cambió. Recargá antes de seguir editando.");
      adopt(current, false); setNotice("Publicación pausada. Ahora podés quitar fotos o el contacto.");
    });
  }
  function reload() {
    if (operation.current) return;
    setFrozen(false); setLoading(true); setError(""); setMissing(false); setSuccess(false); setStep(0); setReloadKey(value => value + 1);
  }
  function startAnother() {
    if (operation.current || locked || dirty) { setError("Guardá los cambios o recargá el borrador antes de empezar otro artículo."); return; }
    store(draftKey, null); idRef.current = null; baseRef.current = null; setBase(null); setForm(emptyArticleForm()); setPhotos([]); setPendingCleanup([]); setStep(0); setNotice("");
  }
  function retryCleanup() {
    if (operation.current || !base || suspended || base.admin_blocked) return;
    void perform(async () => { const client = await activeClient(); const pending = await cleanupPersonalListingPhotos(client, base.id, pendingCleanup); rememberCleanup(base.id, pending); if (pending.length) setNotice("La limpieza sigue pendiente. Podés reintentar más tarde."); });
  }
  return { form, change, base, photos, changePhotos, addPhotos, categories, loading, missing, suspended, busy, preparing,
    frozen, error, notice, step, setStep, success, locked, terminal, dirty, pendingCleanup, save, next, publish, pause, reload, startAnother, retryCleanup, reloadKey };
}

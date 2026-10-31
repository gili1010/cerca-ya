"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PublicServiceCategory, PublicServiceListing, ServicePage } from "@/types/services";
import { readServiceCategories, readServiceListings } from "@/lib/services/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { provinceByCode } from "@/lib/argentina-provinces";
import { personalSearchReturnTo, writeSearchNavigation, type SearchNavigation } from "@/lib/search-navigation";
import { servicePublicHref } from "@/lib/services/search-navigation";
import { ArticleLocality } from "@/components/personal-listings/article-locality";
import { ServiceCard } from "./service-card";
import { useSignedServicePhotos } from "./use-signed-service-photos";
import styles from "@/components/personal-listings/personal-search.module.css";
import { ActiveFilters, FilterPanel, SearchPagination } from "@/components/search/search-controls";
import { LoadingState } from "@/components/ui/primitives";
import searchStyles from "@/components/search/search-experience.module.css";

const pageSize = 12;

export function ServiceSearch({ state, buyerLocality, buyerProvince, enabled, refreshKey, onChange }: {
  state: SearchNavigation; buyerLocality: string | null; buyerProvince: string | null;
  enabled: boolean; refreshKey: number; onChange: (patch: Partial<SearchNavigation>) => void;
}) {
  const customPlace = Boolean(state.serviceLocality || state.serviceProvince);
  const personalPlace = Boolean(state.personalLocality && state.personalProvince);
  const locality = customPlace ? state.serviceLocality : personalPlace ? state.personalLocality : buyerLocality ?? "";
  const province = customPlace ? state.serviceProvince : personalPlace ? state.personalProvince : buyerProvince ?? "";
  const hasPlace = Boolean(locality && provinceByCode(province));
  const [categories, setCategories] = useState<PublicServiceCategory[] | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draftCity, setDraftCity] = useState(""), [draftProvince, setDraftProvince] = useState("");
  const [response, setResponse] = useState<{ key: string; data?: ServicePage<PublicServiceListing>; error?: string } | null>(null);
  const category = categories?.find(item => item.id === state.serviceCategory);
  const categoryReady = Boolean(categories && (!state.serviceCategory || category));
  const key = JSON.stringify({ locality, province, query: state.query, category: state.serviceCategory, page: state.servicePage });
  const current = enabled && hasPlace && categoryReady && response?.key === key ? response : null;
  const data = current?.data;
  const loading = enabled && hasPlace && categoryReady && !current;

  // Keep the component mounted across tabs; category options are reused, not fetched on every render.
  useEffect(() => {
    if (!enabled || categories) return;
    let live = true;
    const controller = new AbortController();
    async function load() {
      try {
        const client = getSupabaseBrowserClient(); if (!client) throw new Error();
        const rows = await readServiceCategories(client, controller.signal);
        if (live) { setCategories(rows); setCategoryError(""); }
      } catch { if (live) setCategoryError("No pudimos cargar las categorías de servicios."); }
    }
    void load();
    return () => { live = false; controller.abort(); };
  }, [enabled, categories, categoryAttempt]);

  useEffect(() => {
    if (!enabled || !hasPlace || !categoryReady) return;
    let live = true;
    const controller = new AbortController();
    setResponse(null);
    const timer = window.setTimeout(async () => {
      try {
        const client = getSupabaseBrowserClient(); if (!client) throw new Error();
        const result = await readServiceListings(client, { locality, provinceCode: province, query: state.query,
          categoryId: state.serviceCategory || null, page: state.servicePage, pageSize }, controller.signal);
        if (live) setResponse({ key, data: result });
      } catch { if (live) setResponse({ key, error: "No pudimos buscar servicios. Volvé a intentar." }); }
    }, 300);
    return () => { live = false; controller.abort(); window.clearTimeout(timer); };
  }, [enabled, hasPlace, categoryReady, key, locality, province, state.query, state.serviceCategory, state.servicePage, attempt, refreshKey]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState === "visible") { setResponse(null); setAttempt(value => value + 1); } };
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    return () => { window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); };
  }, [enabled]);

  const signed = useSignedServicePhotos(data?.items.flatMap(item => item.images[0] ? [item.images[0].object_path] : []) ?? []);
  const returnTo = personalSearchReturnTo(`/?${writeSearchNavigation(new URLSearchParams(), {
    ...state, serviceLocality: locality, serviceProvince: province,
  })}#servicios`);
  const context = { returnTo, locality, province };
  const lastPage = Math.max(0, Math.ceil((data?.total ?? 0) / pageSize) - 1);
  const stalePage = Boolean(data && state.servicePage > lastPage);
  const groups = categories?.filter(item => !item.parent_id) ?? [];

  return <section hidden={!enabled} id="servicios" className={`${styles.section} ${state.domain === "all" ? searchStyles.overviewSection : ""}`} aria-labelledby="service-results-title" aria-busy={loading}>
    <div className={styles.heading}><div><h2 id="service-results-title">Profesionales y oficios</h2><p>Profesionales que trabajan en la localidad que elegís.</p></div><Link className={searchStyles.contextAction} href="/necesito-un-servicio">Necesito un servicio</Link></div>
    <FilterPanel expanded={editing} collapsible={state.domain === "all"} title={state.domain === "all" ? hasPlace ? `Servicios en ${locality} · Localidad y filtros` : "Servicios · Elegir localidad y filtros" : "Filtros de servicios"}>
      <label className={styles.field}>Grupo o especialidad
        <select value={state.serviceCategory} disabled={!categories} onChange={event => onChange({ serviceCategory: event.target.value, servicePage: 0 })}>
          <option value="">Todos los servicios</option>
          {state.serviceCategory && !category && <option value={state.serviceCategory}>Categoría no disponible</option>}
          {groups.map(group => <optgroup key={group.id} label={group.name}>
            <option value={group.id}>Todo: {group.name}</option>
            {categories?.filter(item => item.parent_id === group.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </optgroup>)}
        </select>
      </label>
      <p className={styles.metadata}>{hasPlace ? `Cobertura en ${locality}, ${provinceByCode(province)?.name}.` : "Elegí localidad y provincia para buscar servicios. No necesitás GPS."}</p>
      {hasPlace && !editing && <button type="button" className="secondary-link" onClick={() => { setDraftCity(locality); setDraftProvince(province); setEditing(true); }}>Cambiar localidad de artículos y servicios</button>}
      {(editing || !hasPlace) && <form onSubmit={event => {
        event.preventDefault(); if (!draftCity.trim() || !provinceByCode(draftProvince)) return;
        onChange({ serviceLocality: draftCity.trim(), serviceProvince: draftProvince, servicePage: 0 }); setEditing(false);
      }}><p className={styles.metadata}>Esta elección se comparte con artículos particulares. No cambia la ubicación de comercios.</p><ArticleLocality city={draftCity} province={draftProvince} onCity={setDraftCity} onProvince={value => { setDraftProvince(value); setDraftCity(""); }} disabled={false}/>
        <div className={styles.selector}><button type="submit" className="primary-button" disabled={!draftCity.trim() || !provinceByCode(draftProvince)}>Buscar en esta localidad</button>{hasPlace && <button type="button" className="outline-button" onClick={() => setEditing(false)}>Cancelar</button>}</div>
      </form>}
      {customPlace && buyerLocality && provinceByCode(buyerProvince) && <button type="button" className="secondary-link" onClick={() => onChange({ serviceLocality: "", serviceProvince: "", servicePage: 0, personalLocality: "", personalProvince: "", personalPage: 0 })}>Usar mi localidad actual</button>}
    </FilterPanel>
    <ActiveFilters label="Filtros de servicios" items={state.serviceCategory ? [{ key: "category", label: category?.name ?? "Especialidad seleccionada", onRemove: () => onChange({ serviceCategory: "", servicePage: 0 }) }] : []} onClear={() => onChange({ serviceCategory: "", servicePage: 0 })}/>
    {categoryError && <div className={styles.notice}><p role="alert">{categoryError}</p><button type="button" className="outline-button" onClick={() => { setCategoryError(""); setCategoryAttempt(value => value + 1); }}>Reintentar categorías</button></div>}
    {!categories && !categoryError && <p role="status">Cargando categorías…</p>}
    {categories && !categoryReady && <p className={styles.notice}>La categoría seleccionada no está disponible. Elegí otra categoría.</p>}
    {loading && <LoadingState label="Buscando servicios…"/>}
    {current?.error && <div className={styles.notice}><p role="alert">{current.error}</p><button type="button" className="outline-button" onClick={() => { setResponse(null); setAttempt(value => value + 1); }}>Reintentar servicios</button></div>}
    {data && <>
      <p className={styles.metadata} role="status">{data.total} servicios en {locality}{state.query && ` para “${state.query}”`}</p>
      <div className={`${styles.grid} ${searchStyles.resultGrid}`}>{data.items.map(item => <ServiceCard headingLevel={3} key={item.id} listing={item} urls={signed.urls}
        detailHref={servicePublicHref("servicio", item.id, context)} providerHref={servicePublicHref("prestador", item.provider_id, context)}/>)}</div>
      {signed.error && <p className={styles.metadata}>{signed.error} <button type="button" className="secondary-link" onClick={signed.refresh}>Reintentar fotos</button></p>}
      {stalePage ? <div className={styles.notice}><p>Esta página ya no tiene servicios disponibles.</p><button type="button" className="outline-button" onClick={() => onChange({ servicePage: 0 })}>Volver a la primera página</button></div> : !data.total && <div className={`${styles.notice} ${state.domain === "all" ? searchStyles.compactEmpty : ""}`}><h3>No encontramos profesionales que atiendan esta localidad con esos filtros.</h3><p>Probá otro oficio o especialidad, o cambiá la localidad.</p><Link className="primary-button" href="/necesito-un-servicio">Necesito un servicio</Link></div>}
      {!stalePage && <SearchPagination page={state.servicePage} pageSize={pageSize} total={data.total} label="Páginas de servicios" onPage={value => { onChange({ servicePage: value }); document.getElementById("servicios")?.scrollIntoView({ block: "start" }); }}/>}
    </>}
  </section>;
}








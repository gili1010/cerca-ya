"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategoryRow } from "@/types/database";
import { personalSearchReturnTo, writeSearchNavigation, type SearchNavigation } from "@/lib/search-navigation";
import { provinceByCode } from "@/lib/argentina-provinces";
import { usePublicPersonalListings } from "@/lib/personal-listings/use-public-listings";
import { ArticleLocality } from "./article-locality";
import { PublicListingCard } from "./public-listing-card";
import { useSignedPersonalPhotos } from "./use-signed-photos";
import styles from "./personal-search.module.css";
import { ActiveFilters, FilterPanel, SearchPagination } from "@/components/search/search-controls";
import { LoadingState } from "@/components/ui/primitives";
import searchStyles from "@/components/search/search-experience.module.css";

export function PersonalSearch({ state, categories, categoriesLoading, categoryError, onCategoriesRetry, buyerLocality, buyerProvince, onChange }: {
  state: SearchNavigation; categories: CategoryRow[]; categoriesLoading: boolean; categoryError: string; onCategoriesRetry: () => void;
  buyerLocality: string | null; buyerProvince: string | null; onChange: (patch: Partial<SearchNavigation>) => void;
}) {
  // Manual locality uses the existing shared article/service scope, never commerce GPS.
  const customPlace = Boolean(state.personalLocality || state.personalProvince);
  const locality = customPlace ? state.personalLocality : buyerLocality ?? "";
  const province = customPlace ? state.personalProvince : buyerProvince ?? "";
  const hasPlace = Boolean(locality.trim() && provinceByCode(province));
  const returnParams = writeSearchNavigation(new URLSearchParams(), { ...state, personalLocality: locality, personalProvince: province });
  const returnTo = personalSearchReturnTo(`/?${returnParams}#particulares`);
  const [editingPlace, setEditingPlace] = useState(false);
  const [draftCity, setDraftCity] = useState(""), [draftProvince, setDraftProvince] = useState("");
  const personalCategory = state.personalCategory ?? state.category;
  const category = categories.find(item => item.slug === personalCategory);
  const categoryReady = !personalCategory || Boolean(category);
  const results = usePublicPersonalListings({ locality, provinceCode: province, query: state.query, categoryId: category?.id ?? null,
    condition: state.personalCondition, sort: state.personalSort, page: state.personalPage, pageSize: 24 }, hasPlace && categoryReady);
  const photos = useSignedPersonalPhotos(results.items.flatMap(item => { const photo = item.images.find(image => image.position === 0); return photo ? [photo.object_path] : []; }));
  const maxPage = Math.max(0, Math.ceil(results.total / results.pageSize) - 1);
  // A stale page offers an explicit safe return without broadening filters or scope.
  const stalePage = !results.loading && !results.error && state.personalPage > maxPage;
  function openPlace() { setDraftCity(locality); setDraftProvince(province); setEditingPlace(true); }
  return <section className={`${styles.section} ${state.domain === "all" ? searchStyles.overviewSection : ""}`} id="particulares" aria-labelledby="personal-results-title" aria-busy={results.loading}>
    <div className={styles.heading}><div><h2 id="personal-results-title">Artículos de vecinos</h2><p>Artículos nuevos y usados de vecinos de tu localidad.</p></div></div>
    <FilterPanel expanded={editingPlace} collapsible={state.domain === "all"} title={state.domain === "all" ? hasPlace ? `Artículos en ${locality} · Localidad y filtros` : "Artículos · Elegir localidad y filtros" : "Filtros de particulares"}>
      <div className={styles.fields}>
        <label className={styles.field}>Categoría<select value={personalCategory} disabled={categoriesLoading || Boolean(categoryError)} onChange={event => onChange({ personalCategory: event.target.value, personalPage: 0 })}><option value="">Todas las categorías</option>{personalCategory && !category && <option value={personalCategory}>Categoría no disponible</option>}{categories.map(item => <option key={item.id} value={item.slug}>{item.name}</option>)}</select></label>
        <label className={styles.field}>Condición<select value={state.personalCondition ?? ""} onChange={event => onChange({ personalCondition: event.target.value === "NEW" ? "NEW" : event.target.value === "USED" ? "USED" : null, personalPage: 0 })}><option value="">Nuevos y usados</option><option value="NEW">Nuevo</option><option value="USED">Usado</option></select></label>
        <label className={styles.field}>Ordenar artículos<select value={state.personalSort} onChange={event => onChange({ personalSort: event.target.value === "price_asc" ? "price_asc" : event.target.value === "price_desc" ? "price_desc" : "newest", personalPage: 0 })}><option value="newest">Más recientes</option><option value="price_asc">Precio menor a mayor</option><option value="price_desc">Precio mayor a menor</option></select></label>
      </div>
      {categoryError && <p role="alert">{categoryError} <button type="button" className="secondary-link" onClick={onCategoriesRetry}>Reintentar categorías</button></p>}
      <p className={styles.metadata}>{hasPlace ? `En ${locality}, ${provinceByCode(province)?.name}. Sin distancias calculadas.` : "Elegí localidad y provincia para encontrar artículos particulares. No necesitás GPS."}</p>
      {hasPlace && !editingPlace && <button type="button" className="secondary-link" onClick={openPlace}>Cambiar localidad de artículos y servicios</button>}
      {(editingPlace || !hasPlace) && <form onSubmit={event => { event.preventDefault(); if (!draftCity.trim() || !provinceByCode(draftProvince)) return; onChange({ personalLocality: draftCity.trim(), personalProvince: draftProvince, personalPage: 0 }); setEditingPlace(false); }}>
        <p className={styles.metadata}>Esta elección se comparte con servicios. No cambia la ubicación de comercios.</p>
        <ArticleLocality city={draftCity} province={draftProvince} onCity={setDraftCity} onProvince={value => { setDraftProvince(value); setDraftCity(""); }} disabled={false} />
        <div className={styles.selector}><button type="submit" className="primary-button" disabled={!draftCity.trim() || !provinceByCode(draftProvince)}>Buscar en esta localidad</button>{hasPlace && <button type="button" className="outline-button" onClick={() => setEditingPlace(false)}>Cancelar</button>}</div>
      </form>}
      {customPlace && buyerLocality && provinceByCode(buyerProvince) && <button type="button" className="secondary-link" onClick={() => { onChange({ personalLocality: "", personalProvince: "", personalPage: 0 }); setEditingPlace(false); }}>Usar mi localidad actual</button>}

    </FilterPanel>
    <ActiveFilters label="Filtros de particulares" items={[
      ...(personalCategory ? [{ key: "category", label: category?.name ?? "Categoría seleccionada", onRemove: () => onChange({ personalCategory: "", personalPage: 0 }) }] : []),
      ...(state.personalCondition ? [{ key: "condition", label: state.personalCondition === "NEW" ? "Nuevo" : "Usado", onRemove: () => onChange({ personalCondition: null, personalPage: 0 }) }] : []),
      ...(state.personalSort !== "newest" ? [{ key: "sort", label: state.personalSort === "price_asc" ? "Menor precio" : "Mayor precio", onRemove: () => onChange({ personalSort: "newest", personalPage: 0 }) }] : []),
    ]} onClear={() => onChange({ personalCategory: "", personalCondition: null, personalSort: "newest", personalPage: 0 })}/>
    {personalCategory && !categoryReady && <p className={styles.notice} role="status">{categoriesLoading ? "Cargando la categoría seleccionada…" : categoryError || "La categoría seleccionada no está disponible. Elegí otra categoría."}</p>}
    {hasPlace && categoryReady && <>
      <p className={styles.metadata} role="status">{results.loading ? "Buscando artículos…" : results.error ? "Artículos no disponibles en este momento" : `${results.total} ${results.total === 1 ? "artículo" : "artículos"} en ${locality}`}{state.query && ` para “${state.query}”`}</p>
      {results.loading && <LoadingState label="Buscando artículos…"/>}
      {results.error && <div className={styles.notice}><p role="alert">{results.error}</p><button type="button" className="outline-button" onClick={results.retry}>Reintentar</button></div>}
      {!results.loading && !results.error && <>
        {photos.error && <p className={styles.metadata} role="status">{photos.error} <button type="button" className="secondary-link" onClick={photos.refresh}>Reintentar fotos</button></p>}
        <div className={`${styles.grid} ${searchStyles.resultGrid}`}>{results.items.map(item => <PublicListingCard key={item.id} listing={item} photoUrl={photos.urls[item.images.find(image => image.position === 0)?.object_path ?? ""]} returnTo={returnTo} />)}</div>
        {stalePage ? <div className={styles.notice}><p>Esta página ya no tiene artículos disponibles.</p><button type="button" className="outline-button" onClick={() => onChange({ personalPage: 0 })}>Volver a la primera página</button></div> : results.total === 0 && <div className={`${styles.notice} ${state.domain === "all" ? searchStyles.compactEmpty : ""}`}><h3>No encontramos artículos en esta localidad con estos filtros.</h3><p>Probá otra búsqueda o condición, o elegí otra localidad.</p><button type="button" className="outline-button" onClick={openPlace}>Cambiar localidad</button><Link className="secondary-link" href={`/pedido/nuevo?q=${encodeURIComponent(state.query)}`}>Pedir un producto a comercios</Link></div>}
        {!stalePage && <SearchPagination page={state.personalPage} pageSize={results.pageSize} total={results.total} label="Páginas de artículos particulares" onPage={value => { onChange({ personalPage: value }); document.getElementById("particulares")?.scrollIntoView({ block: "start" }); }}/>}
      </>}
    </>}
  </section>;
}







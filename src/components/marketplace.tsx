"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CategoryRow } from "@/types/database";
import type { QuickFilter, SortOrder } from "@/lib/products";
import { provinceByCode } from "@/lib/argentina-provinces";
import { getPublicCategories } from "@/lib/public-catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePublicCatalog } from "@/lib/use-public-catalog";
import { usePublicStoreSearch } from "@/lib/use-public-store-search";
import { Header } from "./home/header";
import { Hero } from "./home/hero";
import { Categories } from "./home/categories";
import { Catalog } from "./home/catalog";
import { Footer } from "./home/footer";
import { MobileNav, type MobileTab } from "./home/mobile-nav";
import { useDemo } from "./demo-provider";
import { useUserLocation } from "./location/user-location-provider";
import { recordSearch } from "@/lib/search-analytics";
import { readSearchNavigation, writeSearchNavigation, type SearchNavigation } from "@/lib/search-navigation";

export default function Marketplace() {
  const router = useRouter();
  const { coordinates, locality, provinceCode } = useUserLocation();
  const { favorites, toggleFavorite, zone, setModal, setHomeTab } = useDemo();
  const searchParams = useSearchParams();
  const { query, category, filters, sort, page, localityPage, radiusKm, view: activeTab } = readSearchNavigation(new URLSearchParams(searchParams.toString()));
  // URL is the source of navigation state. Restoring it never creates a measurement.
  const updateNavigation = (patch: Partial<SearchNavigation>) => {
    const params = new URLSearchParams(window.location.search);
    const current = readSearchNavigation(params);
    const changedCriteria = (["query", "category", "sort", "view"] as const).some(key => key in patch && patch[key] !== current[key])
      || (patch.filters !== undefined && JSON.stringify(patch.filters) !== JSON.stringify(current.filters));
    const next = writeSearchNavigation(params, { ...current, ...(changedCriteria ? { page: 0, localityPage: 0 } : {}), ...patch });
    const queryString = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`);
  };
  const setQuery = (value: string) => updateNavigation({ query: value });
  const setCategory = (value: string) => updateNavigation({ category: value });
  const setFilters = (value: QuickFilter[]) => updateNavigation({ filters: value });
  const setSort = (value: SortOrder) => updateNavigation({ sort: value });
  const setPage = (value: number) => updateNavigation({ page: value });
  const setLocalityPage = (value: number) => updateNavigation({ localityPage: value });
  const setActiveTab = (value: SearchNavigation["view"]) => { setHomeTab(value); updateNavigation({ view: value }); };
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const favoritesOnly = activeTab === "saved";
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveFilters = filters.filter(filter => filter !== "nearby" && (coordinates || filter !== "delivery"));
  const effectiveSort = !coordinates && sort === "distance" ? "recommended" : sort;
  const canonicalLocality = provinceByCode(provinceCode) && locality?.trim() ? locality.trim() : null;
  const locationScope = JSON.stringify({ coordinates, locality: canonicalLocality, provinceCode });
  // Reset pagination with the location, without ever putting coordinates in a URL.
  const pageLocation = useRef(locationScope);
  useEffect(() => {
    if (pageLocation.current === locationScope) return;
    pageLocation.current = locationScope;
    const params = new URLSearchParams(window.location.search);
    const current = readSearchNavigation(params);
    const next = writeSearchNavigation(params, { ...current, page: 0, localityPage: 0,
      filters: coordinates ? current.filters : current.filters.filter(filter => filter !== "nearby" && filter !== "delivery"),
      sort: !coordinates && current.sort === "distance" ? "recommended" : current.sort });
    window.history.replaceState(null, "", `${window.location.pathname}?${next}${window.location.hash}`);
  }, [coordinates, locationScope]);
  const catalogOptions = { query, category, filters: effectiveFilters, sort: effectiveSort, home: activeTab === "home" && !query.trim() && !category && !favoritesOnly, favoriteIds: favoritesOnly ? favorites : undefined, buyerLocation: coordinates, locality: canonicalLocality, provinceCode, radiusKm };
  const catalog = usePublicCatalog({ ...catalogOptions, group: "distance", enabled: Boolean(coordinates), page });
  const localityCatalog = usePublicCatalog({ ...catalogOptions, group: "locality", enabled: Boolean(canonicalLocality), page: localityPage });
  const storeScope = { buyerLocation: coordinates, locality: canonicalLocality, provinceCode, radiusKm };
  const storeSearch = usePublicStoreSearch(query, !favoritesOnly && Boolean(coordinates), { ...storeScope, group: "distance" });
  const localityStoreSearch = usePublicStoreSearch(query, !favoritesOnly && Boolean(canonicalLocality), { ...storeScope, group: "locality" });
  // Saved URLs and changing availability must not strand either group beyond its last page.
  useEffect(() => {
    const patch: Partial<SearchNavigation> = {};
    if (!catalog.loading && !catalog.error && page > Math.max(0, Math.ceil(catalog.total / catalog.pageSize) - 1)) patch.page = Math.max(0, Math.ceil(catalog.total / catalog.pageSize) - 1);
    if (!localityCatalog.loading && !localityCatalog.error && localityPage > Math.max(0, Math.ceil(localityCatalog.total / localityCatalog.pageSize) - 1)) patch.localityPage = Math.max(0, Math.ceil(localityCatalog.total / localityCatalog.pageSize) - 1);
    if (Object.keys(patch).length) {
      const params = new URLSearchParams(window.location.search);
      const next = writeSearchNavigation(params, { ...readSearchNavigation(params), ...patch });
      window.history.replaceState(null, "", `${window.location.pathname}${next.size ? `?${next}` : ""}${window.location.hash}`);
    }
  }, [page, localityPage, catalog.loading, catalog.error, catalog.total, catalog.pageSize, localityCatalog.loading, localityCatalog.error, localityCatalog.total, localityCatalog.pageSize]);
  // Sólo se arma una medición con intención explícita, nunca al escribir/renderizar.
  const searchContext = JSON.stringify({ query, category, filters: effectiveFilters, sort: effectiveSort, coordinates, locality: canonicalLocality, provinceCode, radiusKm, favoritesOnly });
  const [measurement, setMeasurement] = useState<{ id: string; context: string; query: string; categoryId: string | null; locality: string | null } | null>(null);
  const lastSubmit = useRef<{ context: string; at: number } | null>(null);
  const consumedMeasurement = useRef<string | null>(null);
  useEffect(() => {
    if (!measurement || consumedMeasurement.current === measurement.id) return;
    if (measurement.context !== searchContext || catalog.error || localityCatalog.error) { consumedMeasurement.current = measurement.id; return; }
    if (catalog.loading || localityCatalog.loading) return;
    consumedMeasurement.current = measurement.id;
    void recordSearch({ ...measurement, resultCount: catalog.total + localityCatalog.total, distanceResultCount: catalog.total, localityResultCount: localityCatalog.total });
  }, [measurement, searchContext, catalog.loading, catalog.error, catalog.total, localityCatalog.loading, localityCatalog.error, localityCatalog.total]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("catalog_unavailable");
      return getPublicCategories(client);
    };
    load().then(data => { if (live) { setCategories(data); setCategoryError(""); setCategoryLoading(false); } })
      .catch(() => { if (live) { setCategoryError("No pudimos cargar las categorías."); setCategoryLoading(false); } });
    return () => { live = false; };
  }, [categoryAttempt]);

  const goToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  const reset = () => { setQuery(""); setCategory(""); setFilters([]); setSort("recommended"); setActiveTab("search"); setPage(0); };
  const toggleFilter = (filter: QuickFilter) => { if ((filter === "nearby" || filter === "delivery") && !coordinates) return; setFilters(filters.includes(filter) ? filters.filter(item => item !== filter) : [...filters, filter]); setPage(0); };
  const showSaved = () => { setActiveTab(favoritesOnly ? "home" : "saved"); setQuery(""); setCategory(""); setFilters([]); setPage(0); goToCatalog(); };
  const search = () => {
    const term = query.trim().replace(/\s+/g, " ");
    const previous = lastSubmit.current;
    try {
      if ((coordinates || canonicalLocality) && !favoritesOnly && term.length >= 2 && term.length <= 120 && (!previous || previous.context !== searchContext || Date.now() - previous.at >= 2000)) {
        lastSubmit.current = { context: searchContext, at: Date.now() };
        setMeasurement({ id: crypto.randomUUID(), context: searchContext, query: term, categoryId: categories.find(item => item.slug === category)?.id ?? null, locality: canonicalLocality });
      }
    } catch { /* Incluso sin soporte para UUID, la búsqueda sigue funcionando. */ }
    setActiveTab("search"); setPage(0); setLocalityPage(0); goToCatalog();
  };
  const selectTab = (tab: MobileTab) => {
    if (tab === "account") { setModal("account"); return; }
    if (tab === "requests") { router.push("/pedidos"); return; }
    setActiveTab(tab); setPage(0); setLocalityPage(0);
    if (tab === "home") { setQuery(""); setCategory(""); setFilters(["today"]); setSort("recommended"); window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (tab === "search") { setFilters([]); inputRef.current?.focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
    if (tab === "saved") { setQuery(""); setCategory(""); setFilters([]); goToCatalog(); }
  };
  const urgent = filters.includes("today") && filters.includes("confirmed");

  return <>
    <Header zone={zone} onZone={() => setModal("zone")} onAccount={() => setModal("account")} onExplore={goToCatalog} onRequests={() => router.push("/pedidos")} onHow={() => setModal("how")} />
    <main className="shell">
      <Hero query={query} inputRef={inputRef} onQuery={value => { setQuery(value); setPage(0); if (activeTab !== "search") { setFilters([]); setActiveTab("search"); } }} onSearch={search} onRequest={() => router.push(`/pedido/nuevo?q=${encodeURIComponent(query)}`)} urgent={urgent} onUrgent={() => { setFilters(["today", "confirmed"]); setActiveTab("search"); setSort("recommended"); setPage(0); goToCatalog(); }} />
      <Categories categories={categories} selected={category} loading={categoryLoading} error={categoryError} onRetry={() => { setCategoryLoading(true); setCategoryError(""); setCategoryAttempt(value => value + 1); }} onChange={value => { setCategory(value); setQuery(""); setFilters([]); setActiveTab("search"); setPage(0); goToCatalog(); }} />
      <Catalog {...catalog} localityCatalog={localityCatalog} localityPage={localityPage} onLocalityPage={value => { setLocalityPage(value); goToCatalog(); }} localityStoreSearch={localityStoreSearch} storeSearch={storeSearch} radiusKm={radiusKm} locality={canonicalLocality} onRadius={value => updateNavigation({ radiusKm: value, page: 0 })} hasLocation={Boolean(coordinates)} onLocation={() => setModal("zone")} onRetry={catalog.retry} page={page} onPage={value => { setPage(value); goToCatalog(); }} filters={effectiveFilters} category={categories.find(item => item.slug === category)?.name ?? category} query={query} favorites={favorites} favoritesOnly={favoritesOnly} sort={effectiveSort} onToggleFilter={toggleFilter} onSort={value => { setSort(value); setPage(0); }} onReset={reset} onSave={id => { toggleFavorite(id); if (favoritesOnly) { setPage(0); setLocalityPage(0); } }} onFavorites={showSaved} />
      <Footer onHow={() => setModal("how")} />
    </main>
    <MobileNav active={activeTab} savedCount={favorites.length} onSelect={selectTab} />
  </>;
}

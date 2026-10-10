"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CategoryRow } from "@/types/database";
import type { QuickFilter, SortOrder } from "@/lib/products";
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
  const { coordinates, locality } = useUserLocation();
  const { favorites, toggleFavorite, zone, setModal, setHomeTab } = useDemo();
  const searchParams = useSearchParams();
  const { query, category, filters, sort, page, view: activeTab } = readSearchNavigation(new URLSearchParams(searchParams.toString()));
  // URL is the source of navigation state. Restoring it never creates a measurement.
  const updateNavigation = (patch: Partial<SearchNavigation>) => {
    const params = new URLSearchParams(window.location.search);
    const next = writeSearchNavigation(params, { ...readSearchNavigation(params), ...patch });
    const queryString = next.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${queryString ? `?${queryString}` : ""}${window.location.hash}`);
  };
  const setQuery = (value: string) => updateNavigation({ query: value });
  const setCategory = (value: string) => updateNavigation({ category: value });
  const setFilters = (value: QuickFilter[]) => updateNavigation({ filters: value });
  const setSort = (value: SortOrder) => updateNavigation({ sort: value });
  const setPage = (value: number) => updateNavigation({ page: value });
  const setActiveTab = (value: SearchNavigation["view"]) => { setHomeTab(value); updateNavigation({ view: value }); };
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const favoritesOnly = activeTab === "saved";
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveFilters = coordinates ? filters : filters.filter(filter => filter !== "nearby");
  const effectiveSort = !coordinates && sort === "distance" ? "recommended" : sort;
  // Reset pagination with the location, without ever putting coordinates in a URL.
  const pageLocation = useRef(coordinates);
  useEffect(() => {
    if (pageLocation.current === coordinates) return;
    pageLocation.current = coordinates;
    const params = new URLSearchParams(window.location.search);
    const current = readSearchNavigation(params);
    const next = writeSearchNavigation(params, { ...current, page: 0,
      filters: coordinates ? current.filters : current.filters.filter(filter => filter !== "nearby"),
      sort: !coordinates && current.sort === "distance" ? "recommended" : current.sort });
    window.history.replaceState(null, "", `${window.location.pathname}?${next}${window.location.hash}`);
  }, [coordinates]);
  const catalog = usePublicCatalog({ query, category, filters: effectiveFilters, sort: effectiveSort, home: activeTab === "home" && !query.trim() && !category && !favoritesOnly, page, favoriteIds: favoritesOnly ? favorites : undefined, buyerLocation: coordinates });
  const storeSearch = usePublicStoreSearch(query, !favoritesOnly, Boolean(coordinates));
  // Sólo se arma una medición con intención explícita, nunca al escribir/renderizar.
  const searchContext = JSON.stringify({ query, category, filters: effectiveFilters, sort: effectiveSort, coordinates, favoritesOnly });
  const [measurement, setMeasurement] = useState<{ id: string; context: string; query: string; categoryId: string | null; locality: string | null } | null>(null);
  const lastSubmit = useRef<{ context: string; at: number } | null>(null);
  const consumedMeasurement = useRef<string | null>(null);
  useEffect(() => {
    if (!measurement || consumedMeasurement.current === measurement.id) return;
    if (measurement.context !== searchContext || catalog.error) { consumedMeasurement.current = measurement.id; return; }
    if (catalog.loading) return;
    consumedMeasurement.current = measurement.id;
    void recordSearch({ ...measurement, resultCount: catalog.total });
  }, [measurement, searchContext, catalog.loading, catalog.error, catalog.total]);

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
  const toggleFilter = (filter: QuickFilter) => { if (filter === "nearby" && !coordinates) return; setFilters(filters.includes(filter) ? filters.filter(item => item !== filter) : [...filters, filter]); setPage(0); };
  const showSaved = () => { setActiveTab(favoritesOnly ? "home" : "saved"); setQuery(""); setCategory(""); setFilters([]); setPage(0); goToCatalog(); };
  const search = () => {
    const term = query.trim().replace(/\s+/g, " ");
    const previous = lastSubmit.current;
    try {
      if (!favoritesOnly && term.length >= 2 && term.length <= 120 && (!previous || previous.context !== searchContext || Date.now() - previous.at >= 2000)) {
        lastSubmit.current = { context: searchContext, at: Date.now() };
        setMeasurement({ id: crypto.randomUUID(), context: searchContext, query: term, categoryId: categories.find(item => item.slug === category)?.id ?? null, locality });
      }
    } catch { /* Incluso sin soporte para UUID, la búsqueda sigue funcionando. */ }
    setActiveTab("search"); setPage(0); goToCatalog();
  };
  const selectTab = (tab: MobileTab) => {
    if (tab === "account") { setModal("account"); return; }
    if (tab === "requests") { router.push("/pedidos"); return; }
    setActiveTab(tab); setPage(0);
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
      <Catalog {...catalog} storeSearch={storeSearch} hasLocation={Boolean(coordinates)} onLocation={() => setModal("zone")} onRetry={catalog.retry} page={page} onPage={value => { setPage(value); goToCatalog(); }} filters={effectiveFilters} category={categories.find(item => item.slug === category)?.name ?? category} query={query} favorites={favorites} favoritesOnly={favoritesOnly} sort={effectiveSort} onToggleFilter={toggleFilter} onSort={value => { setSort(value); setPage(0); }} onReset={reset} onSave={id => { toggleFavorite(id); if (favoritesOnly) setPage(0); }} onFavorites={showSaved} />
      <Footer onHow={() => setModal("how")} />
    </main>
    <MobileNav active={activeTab} savedCount={favorites.length} onSelect={selectTab} />
  </>;
}

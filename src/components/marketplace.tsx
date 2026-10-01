"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CategoryRow } from "@/types/database";
import type { QuickFilter, SortOrder } from "@/lib/products";
import { getPublicCategories } from "@/lib/public-catalog";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { usePublicCatalog } from "@/lib/use-public-catalog";
import { Header } from "./home/header";
import { Hero } from "./home/hero";
import { Categories } from "./home/categories";
import { Catalog } from "./home/catalog";
import { Footer } from "./home/footer";
import { MobileNav, type MobileTab } from "./home/mobile-nav";
import { useDemo } from "./demo-provider";
import { useUserLocation } from "./location/user-location-provider";

export default function Marketplace() {
  const router = useRouter();
  const { coordinates } = useUserLocation();
  const { favorites, toggleFavorite, zone, setModal, homeTab: activeTab, setHomeTab: setActiveTab } = useDemo();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState("");
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [filters, setFilters] = useState<QuickFilter[]>(activeTab === "home" ? ["today"] : []);
  const [sort, setSort] = useState<SortOrder>("recommended");
  const [page, setPage] = useState(0);
  const favoritesOnly = activeTab === "saved";
  const inputRef = useRef<HTMLInputElement>(null);
  const effectiveFilters = coordinates ? filters : filters.filter(filter => filter !== "nearby");
  const effectiveSort = !coordinates && sort === "distance" ? "recommended" : sort;
  // Reset pagination with the location, without ever putting coordinates in a URL.
  const [pageLocation, setPageLocation] = useState(coordinates);
  if (pageLocation !== coordinates) {
    setPageLocation(coordinates); setPage(0);
    if (!coordinates) { setFilters(effectiveFilters); setSort(effectiveSort); }
  }
  const catalog = usePublicCatalog({ query, category, filters: effectiveFilters, sort: effectiveSort, page: pageLocation === coordinates ? page : 0, favoriteIds: favoritesOnly ? favorites : undefined, buyerLocation: coordinates });

  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setCategoryError("No pudimos cargar las categorías."); setCategoryLoading(false); return; }
    getPublicCategories(client).then(data => { if (live) { setCategories(data); setCategoryError(""); setCategoryLoading(false); } })
      .catch(() => { if (live) { setCategoryError("No pudimos cargar las categorías."); setCategoryLoading(false); } });
    return () => { live = false; };
  }, [categoryAttempt]);

  const goToCatalog = () => document.getElementById("catalogo")?.scrollIntoView({ behavior: "smooth" });
  const reset = () => { setQuery(""); setCategory(""); setFilters([]); setSort("recommended"); setActiveTab("search"); setPage(0); };
  const toggleFilter = (filter: QuickFilter) => { if (filter === "nearby" && !coordinates) return; setFilters(current => current.includes(filter) ? current.filter(item => item !== filter) : [...current, filter]); setPage(0); };
  const showSaved = () => { setActiveTab(favoritesOnly ? "home" : "saved"); setQuery(""); setCategory(""); setFilters([]); setPage(0); goToCatalog(); };
  const search = () => { setActiveTab("search"); setPage(0); goToCatalog(); };
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
      <Catalog {...catalog} hasLocation={Boolean(coordinates)} onLocation={() => setModal("zone")} onRetry={catalog.retry} page={page} onPage={value => { setPage(value); goToCatalog(); }} filters={effectiveFilters} category={categories.find(item => item.slug === category)?.name ?? category} query={query} favorites={favorites} favoritesOnly={favoritesOnly} sort={effectiveSort} onToggleFilter={toggleFilter} onSort={value => { setSort(value); setPage(0); }} onReset={reset} onSave={id => { toggleFavorite(id); if (favoritesOnly) setPage(0); }} onFavorites={showSaved} />
      <Footer onHow={() => setModal("how")} />
    </main>
    <MobileNav active={activeTab} savedCount={favorites.length} onSelect={selectTab} />
  </>;
}

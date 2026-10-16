import { catalogRadius, defaultRadius, type CatalogRadius } from "./hyperlocal";
import type { QuickFilter, SortOrder } from "./products";
import type { PersonalItemCondition, PersonalListingSort } from "@/types/personal-listings";
import { provinceByCode } from "./argentina-provinces";

export interface SearchNavigation {
  domain: "all" | "businesses" | "personal" | "services";
  servicePage: number;
  serviceCategory: string;
  serviceLocality: string;
  serviceProvince: string;
  personalPage: number;
  /** null preserves legacy URLs where category applied to both product domains. */
  personalCategory: string | null;
  personalCondition: PersonalItemCondition | null;
  personalSort: PersonalListingSort;
  personalLocality: string;
  personalProvince: string;
  radiusKm: CatalogRadius;
  query: string;
  category: string;
  filters: QuickFilter[];
  sort: SortOrder;
  page: number;
  localityPage: number;
  view: "home" | "search" | "saved";
}
const allowedFilters: QuickFilter[] = ["today", "nearby", "delivery", "pickup", "confirmed"];

export function readSearchNavigation(params: URLSearchParams): SearchNavigation {
  const view = params.get("view");
  const searching = ["q", "category", "personal_category", "filters", "sort", "page", "locality_page"].some(key => params.has(key));
  const mode = view === "home" || view === "saved" ? view : view === "search" || searching ? "search" : "home";
  const rawPage = params.get("page") ?? "0";
  const sort = params.get("sort");
  const rawLocalityPage = params.get("locality_page") ?? "0";
  const domain = params.get("domain"), condition = params.get("condition"), personalSort = params.get("personal_sort");
  const personalPage = params.get("personal_page") ?? "0";
  return {
    domain: domain === "businesses" || domain === "personal" || domain === "services" ? domain : "all",
    servicePage: /^\d+$/.test(params.get("service_page") ?? "") ? Math.min(Number(params.get("service_page")), 100000) : 0,
    serviceCategory: (params.get("service_category") ?? "").slice(0, 160),
    serviceLocality: (params.get("service_locality") ?? "").trim().slice(0, 120),
    serviceProvince: provinceByCode(params.get("service_province"))?.code ?? "",
    personalPage: /^\d+$/.test(personalPage) ? Math.min(Number(personalPage), 100000) : 0,
    personalCategory: params.has("personal_category") ? (params.get("personal_category") ?? "").slice(0, 160) : null,
    personalCondition: condition === "NEW" || condition === "USED" ? condition : null,
    personalSort: personalSort === "price_asc" || personalSort === "price_desc" ? personalSort : "newest",
    personalLocality: (params.get("personal_locality") ?? "").trim().slice(0, 120),
    personalProvince: provinceByCode(params.get("personal_province"))?.code ?? "",
    radiusKm: catalogRadius(Number(params.get("radius") ?? ((params.get("filters") ?? "").split(",").includes("nearby") ? 5 : defaultRadius))),
    query: (params.get("q") ?? "").slice(0, 160),
    category: (params.get("category") ?? "").slice(0, 160),
    filters: params.has("filters") ? allowedFilters.filter(filter => (params.get("filters") ?? "").split(",").includes(filter)) : mode === "home" ? ["today"] : [],
    sort: sort === "distance" || sort === "price" ? sort : "recommended",
    page: /^\d+$/.test(rawPage) ? Math.min(Number(rawPage), 100000) : 0,
    localityPage: /^\d+$/.test(rawLocalityPage) ? Math.min(Number(rawLocalityPage), 100000) : 0,
    view: mode,
  };
}

export function writeSearchNavigation(params: URLSearchParams, state: SearchNavigation): URLSearchParams {
  const result = new URLSearchParams(params);
  for (const key of ["service_page", "service_category", "service_locality", "service_province"]) result.delete(key);
  if (state.servicePage) result.set("service_page", String(state.servicePage));
  if (state.serviceCategory) result.set("service_category", state.serviceCategory);
  if (state.serviceLocality) result.set("service_locality", state.serviceLocality);
  if (state.serviceProvince) result.set("service_province", state.serviceProvince);
  for (const key of ["q", "category", "filters", "sort", "page", "view", "radius", "locality_page", "domain", "personal_page", "condition", "personal_sort", "personal_locality", "personal_province"]) result.delete(key);
  if (state.domain !== "all") result.set("domain", state.domain);
  if (state.personalPage) result.set("personal_page", String(state.personalPage));
  result.delete("personal_category");
  if (state.personalCategory != null) result.set("personal_category", state.personalCategory);
  if (state.personalCondition) result.set("condition", state.personalCondition);
  if (state.personalSort !== "newest") result.set("personal_sort", state.personalSort);
  if (state.personalLocality) result.set("personal_locality", state.personalLocality);
  if (state.personalProvince) result.set("personal_province", state.personalProvince);
  if (state.view !== "home") result.set("view", state.view);
  if (state.radiusKm !== defaultRadius) result.set("radius", String(state.radiusKm));
  if (state.query) result.set("q", state.query);
  if (state.category) result.set("category", state.category);
  const defaultFilters = state.view === "home" ? "today" : "";
  if (state.filters.join(",") !== defaultFilters) result.set("filters", state.filters.join(","));
  if (state.sort !== "recommended") result.set("sort", state.sort);
  if (state.page) result.set("page", String(state.page));
  if (state.localityPage) result.set("locality_page", String(state.localityPage));
  if (state.view === "home" && result.size > 0) result.set("view", "home");
  return result;
}

/** El retorno de un artículo sólo puede ser al explorador local y con sus parámetros conocidos. */
export function personalSearchReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://cercaya.invalid");
    if (url.origin !== "https://cercaya.invalid" || url.pathname !== "/") return "/";
    const params = writeSearchNavigation(new URLSearchParams(), readSearchNavigation(url.searchParams));
    const hash = ["#particulares", "#catalogo", "#explorador", "#servicios"].includes(url.hash) ? url.hash : "";
    return `/${params.size ? `?${params}` : ""}${hash}`;
  } catch { return "/"; }
}

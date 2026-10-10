import type { QuickFilter, SortOrder } from "./products";

export interface SearchNavigation {
  query: string;
  category: string;
  filters: QuickFilter[];
  sort: SortOrder;
  page: number;
  view: "home" | "search" | "saved";
}
const allowedFilters: QuickFilter[] = ["today", "nearby", "delivery", "pickup", "confirmed"];

export function readSearchNavigation(params: URLSearchParams): SearchNavigation {
  const view = params.get("view");
  const searching = ["q", "category", "filters", "sort", "page"].some(key => params.has(key));
  const mode = view === "home" || view === "saved" ? view : view === "search" || searching ? "search" : "home";
  const rawPage = params.get("page") ?? "0";
  const sort = params.get("sort");
  return {
    query: (params.get("q") ?? "").slice(0, 160),
    category: (params.get("category") ?? "").slice(0, 160),
    filters: params.has("filters") ? allowedFilters.filter(filter => (params.get("filters") ?? "").split(",").includes(filter)) : mode === "home" ? ["today"] : [],
    sort: sort === "distance" || sort === "price" ? sort : "recommended",
    page: /^\d+$/.test(rawPage) ? Math.min(Number(rawPage), 100000) : 0,
    view: mode,
  };
}

export function writeSearchNavigation(params: URLSearchParams, state: SearchNavigation): URLSearchParams {
  const result = new URLSearchParams(params);
  for (const key of ["q", "category", "filters", "sort", "page", "view"]) result.delete(key);
  if (state.view !== "home") result.set("view", state.view);
  if (state.query) result.set("q", state.query);
  if (state.category) result.set("category", state.category);
  const defaultFilters = state.view === "home" ? "today" : "";
  if (state.filters.join(",") !== defaultFilters) result.set("filters", state.filters.join(","));
  if (state.sort !== "recommended") result.set("sort", state.sort);
  if (state.page) result.set("page", String(state.page));
  if (state.view === "home" && result.size > 0) result.set("view", "home");
  return result;
}

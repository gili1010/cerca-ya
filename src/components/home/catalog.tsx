import { ArrowDownUp, Heart, MapPin, Search, X } from "lucide-react";
import Link from "next/link";
import { type Product, type QuickFilter, type SortOrder } from "@/lib/products";

import { catalogRadii, type CatalogRadius } from "@/lib/hyperlocal";
import radiusStyles from "./catalog-radius.module.css";
import { ProductCard } from "./product-card";
import { QuickFilters } from "./quick-filters";
import { ProductSkeletonGrid } from "../ui/product-skeleton-grid";
import type { PublicStoreSearchState } from "@/lib/use-public-store-search";
import { StoreSearchResults } from "./store-search-results";
import styles from "./store-search.module.css";

interface CatalogProps {
  products: Product[]; filters: QuickFilter[]; category: string; query: string;
  total: number; pageSize: number; loading: boolean; error: string; onRetry: () => void; page: number; onPage: (page: number) => void;
  favorites: string[]; favoritesOnly: boolean; sort: SortOrder;
  onToggleFilter: (filter: QuickFilter) => void; onSort: (sort: SortOrder) => void;
  onReset: () => void; onSave: (id: string) => void; onFavorites: () => void;
  radiusKm: CatalogRadius; locality: string | null; onRadius: (radius: CatalogRadius) => void;
  hasLocation: boolean; onLocation: () => void;
  storeSearch: PublicStoreSearchState;
}

export function Catalog(props: CatalogProps) {
  const searching = Boolean(props.query.trim()) && !props.favoritesOnly;
  const title = props.favoritesOnly ? "Tus hallazgos guardados" : searching ? "Encontrá productos y tiendas" : props.filters.includes("today") ? "Disponible hoy cerca tuyo" : "Explorá productos cerca tuyo";
  const hasScope = props.hasLocation || Boolean(props.locality?.trim());
  const noStoreResults = !searching || (!props.storeSearch.loading && !props.storeSearch.error && props.storeSearch.stores.length === 0);
  return <section className="catalog" id="catalogo" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><span className="eyebrow catalog-eyebrow"><span className="live-dot" /> MENOS DISTANCIA. MENOS ESPERA.</span><h2 id="catalog-title">{title}<span className="heading-dot">.</span></h2><p>Sabé dónde está, si hay stock y cuándo lo podés tener.</p></div><button className={`saved-toggle ${props.favoritesOnly ? "selected" : ""}`} onClick={props.onFavorites} aria-pressed={props.favoritesOnly}><Heart size={17} />Guardados{props.favorites.length > 0 && <span>{props.favorites.length}</span>}</button></div>
    <div className={radiusStyles.scope} role="group" aria-label="Radio de búsqueda"><span>Distancia</span><div className={radiusStyles.chips}>{catalogRadii.map(radius => <button type="button" key={radius} className={`filter-chip ${props.radiusKm === radius ? "selected" : ""}`} disabled={!props.hasLocation} aria-pressed={props.radiusKm === radius} onClick={() => props.onRadius(radius)}>{radius} km{props.radiusKm === radius ? " ✓" : ""}</button>)}</div><small>{props.hasLocation ? `Mostrando resultados dentro de ${props.radiusKm} km` : props.locality ? `Resultados en ${props.locality}. Activá ubicación para filtrar por distancia.` : "Activá ubicación para buscar cerca."}</small></div>
    {searching && hasScope && <StoreSearchResults {...props.storeSearch} />}
    {searching && hasScope && <div className={styles.productHeading}><h3>Productos</h3><p>El radio se aplica a productos y tiendas. Los demás filtros y el orden se aplican a los productos.</p></div>}
    <div className="catalog-toolbar"><QuickFilters active={props.filters} onToggle={props.onToggleFilter} hasLocation={props.hasLocation} /><label className="sort-select"><ArrowDownUp size={14} /><span className="sr-only">Ordenar productos</span><select value={props.sort} onChange={event => props.onSort(event.target.value as SortOrder)}><option value="recommended">Disponibilidad y relevancia</option><option value="distance" disabled={!props.hasLocation}>{props.hasLocation ? "Más cerca" : "Más cerca · activá tu ubicación"}</option><option value="price">Menor precio</option></select></label></div>
    {!props.hasLocation && <p className="catalog-location-prompt"><MapPin size={16} aria-hidden="true" /><span>Usá tu ubicación para mostrarte productos y comercios cerca tuyo.</span><button className="secondary-link" onClick={props.onLocation}>Usar mi ubicación</button></p>}
    <div className="results-line"><span role="status">{!hasScope ? "Elegí tu ubicación para ver resultados cercanos" : props.loading ? "Cargando productos..." : props.error ? "Productos no disponibles en este momento" : `${props.total} productos`}{props.query && ` para “${props.query}”`}{props.category && ` · ${props.category}`}</span><button onClick={props.onReset}>Limpiar filtros <X size={12} /></button></div>
    {props.error && <div className="empty-state"><p role="alert">{props.error}</p><button className="primary-button" onClick={props.onRetry}>Reintentar</button></div>}
    {props.loading && <ProductSkeletonGrid />}
    {!props.loading && !props.error && <div className="product-grid">{props.products.map(product => <ProductCard key={product.id} product={product} saved={props.favorites.includes(product.id)} onSave={props.onSave} />)}</div>}

    {!props.loading && !props.error && props.total === 0 && (props.hasLocation || props.locality) && <div className="empty-state">{props.favoritesOnly ? <Heart size={30} /> : <Search size={30} />}<h3>{props.favoritesOnly ? "Tus favoritos tienen un lugar acá" : props.hasLocation ? `No encontramos ${noStoreResults ? "resultados" : "productos"} dentro de ${props.radiusKm} km.` : `No encontramos productos en ${props.locality}.`}</h3><p>{props.favoritesOnly ? "Guardá productos con el corazón o quitá filtros para ver tus guardados." : "¿No lo encontraste cerca? Preguntale a comercios cercanos."}</p>{!props.favoritesOnly && props.hasLocation && props.radiusKm < 50 && <button type="button" className="outline-button" onClick={() => props.onRadius(50)}>Ampliar a 50 km</button>}{!props.favoritesOnly && <Link className="primary-button" href={`/pedido/nuevo?q=${encodeURIComponent(props.query)}`}>📢 Crear Pedido Abierto</Link>}<button className="secondary-link empty-reset" onClick={props.onReset}>Limpiar filtros de productos</button></div>}
    {!props.loading && !props.error && props.total > props.pageSize && <nav className="merchant-product-pagination" aria-label="Páginas de resultados"><button className="outline-button" disabled={props.page === 0} onClick={() => props.onPage(props.page - 1)}>Anterior</button><span>{props.page + 1} / {Math.ceil(props.total / props.pageSize)}</span><button className="outline-button" disabled={(props.page + 1) * props.pageSize >= props.total} onClick={() => props.onPage(props.page + 1)}>Siguiente</button></nav>}
    <p className="demo-note">Disponibilidad informada por cada comercio. Consultá antes de acercarte. Distancias aproximadas en línea recta; cuando falta ubicación mostramos la ciudad.</p>
  </section>;
}


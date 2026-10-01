import { ArrowDownUp, Heart, Search, X } from "lucide-react";
import Link from "next/link";
import { type Product, type QuickFilter, type SortOrder } from "@/lib/products";
import { publicPageSize } from "@/lib/public-catalog";
import { ProductCard } from "./product-card";
import { QuickFilters } from "./quick-filters";
import { ProductSkeletonGrid } from "../ui/product-skeleton-grid";

interface CatalogProps {
  products: Product[]; filters: QuickFilter[]; category: string; query: string;
  total: number; loading: boolean; error: string; onRetry: () => void; page: number; onPage: (page: number) => void;
  favorites: string[]; favoritesOnly: boolean; sort: SortOrder;
  onToggleFilter: (filter: QuickFilter) => void; onSort: (sort: SortOrder) => void;
  onReset: () => void; onSave: (id: string) => void; onFavorites: () => void;
  hasLocation: boolean; onLocation: () => void;
}

export function Catalog(props: CatalogProps) {
  const title = props.favoritesOnly ? "Tus hallazgos guardados" : props.filters.includes("today") ? "Disponible hoy cerca tuyo" : "Explorá productos cerca tuyo";
  return <section className="catalog" id="catalogo" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><span className="eyebrow catalog-eyebrow"><span className="live-dot" /> MENOS DISTANCIA. MENOS ESPERA.</span><h2 id="catalog-title">{title}<span className="heading-dot">.</span></h2><p>Sabé dónde está, si hay stock y cuándo lo podés tener.</p></div><button className={`saved-toggle ${props.favoritesOnly ? "selected" : ""}`} onClick={props.onFavorites} aria-pressed={props.favoritesOnly}><Heart size={17} />Guardados{props.favorites.length > 0 && <span>{props.favorites.length}</span>}</button></div>
    <div className="catalog-toolbar"><QuickFilters active={props.filters} onToggle={props.onToggleFilter} hasLocation={props.hasLocation} /><label className="sort-select"><ArrowDownUp size={14} /><span className="sr-only">Ordenar productos</span><select value={props.sort} onChange={event => props.onSort(event.target.value as SortOrder)}><option value="recommended">Stock y confirmación reciente</option><option value="distance" disabled={!props.hasLocation}>{props.hasLocation ? "Más cerca" : "Más cerca · activá tu ubicación"}</option><option value="price">Menor precio</option></select></label></div>
    {!props.hasLocation && <p className="info-note">Activá tu ubicación para filtrar a 5 km y ordenar por cercanía. <button className="secondary-link" onClick={props.onLocation}>Usar mi ubicación</button></p>}
    <div className="results-line"><span role="status">{props.loading ? "Cargando productos..." : props.error ? "Productos no disponibles en este momento" : `${props.total} productos`}{props.query && ` para “${props.query}”`}{props.category && ` · ${props.category}`}</span><button onClick={props.onReset}>Limpiar filtros <X size={12} /></button></div>
    {props.error && <div className="empty-state"><p role="alert">{props.error}</p><button className="primary-button" onClick={props.onRetry}>Reintentar</button></div>}
    {props.loading && <ProductSkeletonGrid />}
    {!props.loading && !props.error && <div className="product-grid">{props.products.map(product => <ProductCard key={product.id} product={product} saved={props.favorites.includes(product.id)} onSave={props.onSave} />)}</div>}
    {!props.loading && !props.error && props.total === 0 && <div className="empty-state">{props.favoritesOnly ? <Heart size={30} /> : <Search size={30} />}<h3>{props.favoritesOnly ? "Tus favoritos tienen un lugar acá" : "No encontramos publicaciones cercanas."}</h3><p>{props.favoritesOnly ? "Guardá productos con el corazón o quitá filtros para ver tus guardados." : "Pero podemos preguntarle a comercios de tu zona."}</p>{!props.favoritesOnly && <Link className="primary-button" href={`/pedido/nuevo?q=${encodeURIComponent(props.query)}`}>📢 Pedirlo a comercios cercanos</Link>}<button className="secondary-link empty-reset" onClick={props.onReset}>Explorar todos los productos</button></div>}
    {!props.loading && !props.error && props.total > publicPageSize && <nav className="merchant-product-pagination" aria-label="Páginas de resultados"><button className="outline-button" disabled={props.page === 0} onClick={() => props.onPage(props.page - 1)}>Anterior</button><span>{props.page + 1} / {Math.ceil(props.total / publicPageSize)}</span><button className="outline-button" disabled={(props.page + 1) * publicPageSize >= props.total} onClick={() => props.onPage(props.page + 1)}>Siguiente</button></nav>}
    <p className="demo-note">Stock informado por cada comercio. Consultá la disponibilidad antes de acercarte. Distancias aproximadas en línea recta; cuando falta ubicación mostramos la ciudad.</p>
  </section>;
}

import { ArrowDownUp, Heart, MapPin, Search, Store, X } from "lucide-react";
import Link from "next/link";
import { type Product, type QuickFilter, type SortOrder } from "@/lib/products";
import { catalogRadii, type CatalogRadius } from "@/lib/hyperlocal";
import type { PublicStoreSearchState } from "@/lib/use-public-store-search";
import { ProductCard } from "./product-card";
import { QuickFilters } from "./quick-filters";
import { ProductSkeletonGrid } from "../ui/product-skeleton-grid";
import { StoreSearchResults } from "./store-search-results";
import radiusStyles from "./catalog-radius.module.css";
import localityStyles from "./catalog-locality.module.css";
import styles from "./store-search.module.css";

interface LocalityCatalogState {
  products: Product[];
  total: number;
  pageSize: number;
  loading: boolean;
  error: string;
  retry: () => void;
}

interface CatalogProps {
  products: Product[]; filters: QuickFilter[]; category: string; query: string;
  total: number; pageSize: number; loading: boolean; error: string; onRetry: () => void; page: number; onPage: (page: number) => void;
  favorites: string[]; favoritesOnly: boolean; sort: SortOrder;
  onToggleFilter: (filter: QuickFilter) => void; onSort: (sort: SortOrder) => void;
  onReset: () => void; onSave: (id: string) => void; onFavorites: () => void;
  radiusKm: CatalogRadius; locality: string | null; onRadius: (radius: CatalogRadius) => void;
  hasLocation: boolean; onLocation: () => void;
  storeSearch: PublicStoreSearchState;
  localityCatalog: LocalityCatalogState;
  localityPage: number;
  onLocalityPage: (page: number) => void;
  localityStoreSearch: PublicStoreSearchState;
}

function CatalogPagination({ total, pageSize, page, onPage, label }: { total: number; pageSize: number; page: number; onPage: (page: number) => void; label: string }) {
  if (total <= pageSize) return null;
  return <nav className={`merchant-product-pagination ${localityStyles.pagination}`} aria-label={label}>
    <button className="outline-button" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</button>
    <span>{page + 1} / {Math.ceil(total / pageSize)}</span>
    <button className="outline-button" disabled={(page + 1) * pageSize >= total} onClick={() => onPage(page + 1)}>Siguiente</button>
  </nav>;
}

export function Catalog(props: CatalogProps) {
  const searching = Boolean(props.query.trim()) && !props.favoritesOnly;
  const title = props.favoritesOnly ? "Tus hallazgos guardados" : searching ? "Encontrá productos y tiendas" : props.filters.includes("today") ? "Disponible hoy cerca tuyo" : "Explorá productos cerca tuyo";
  const hasLocality = Boolean(props.locality?.trim());
  const hasScope = props.hasLocation || hasLocality;
  const local = props.localityCatalog;
  const geographicTotal = props.hasLocation ? props.total : 0;
  const localityTotal = hasLocality ? local.total : 0;
  const productsSettled = (!props.hasLocation || (!props.loading && !props.error)) && (!hasLocality || (!local.loading && !local.error));
  const storesSettled = !searching || ((!props.hasLocation || (!props.storeSearch.loading && !props.storeSearch.error)) && (!hasLocality || (!props.localityStoreSearch.loading && !props.localityStoreSearch.error)));
  const noStoreResults = !searching || ((!props.hasLocation || props.storeSearch.stores.length === 0) && (!hasLocality || props.localityStoreSearch.stores.length === 0));
  const globallyEmpty = hasScope && productsSettled && storesSettled && geographicTotal === 0 && localityTotal === 0;
  const showLocalityGroup = hasLocality && (local.loading || Boolean(local.error) || localityTotal > 0 || (!props.hasLocation && !globallyEmpty));
  const requestHref = `/pedido/nuevo?q=${encodeURIComponent(props.query)}`;

  return <section className="catalog" id="catalogo" aria-labelledby="catalog-title">
    <div className="catalog-heading"><div><span className="eyebrow catalog-eyebrow"><span className="live-dot" /> MENOS DISTANCIA. MENOS ESPERA.</span><h2 id="catalog-title">{title}<span className="heading-dot">.</span></h2><p>Sabé dónde está, si hay stock y cuándo lo podés tener.</p></div><button className={`saved-toggle ${props.favoritesOnly ? "selected" : ""}`} onClick={props.onFavorites} aria-pressed={props.favoritesOnly}><Heart size={17} />Guardados{props.favorites.length > 0 && <span>{props.favorites.length}</span>}</button></div>
    <div className={radiusStyles.scope} role="group" aria-label="Radio de búsqueda"><span>Distancia</span><div className={radiusStyles.chips}>{catalogRadii.map(radius => <button type="button" key={radius} className={`filter-chip ${props.radiusKm === radius ? "selected" : ""}`} disabled={!props.hasLocation} aria-pressed={props.radiusKm === radius} onClick={() => props.onRadius(radius)}>{radius} km{props.radiusKm === radius ? " ✓" : ""}</button>)}</div><small>{props.hasLocation ? `El radio de ${props.radiusKm} km se aplica sólo a resultados con distancia calculable.` : props.locality ? `Explorás por localidad en ${props.locality}. Activá ubicación para filtrar por distancia.` : "Activá ubicación para buscar cerca."}</small></div>

    {searching && props.hasLocation && <StoreSearchResults {...props.storeSearch} id="geographic-store-search-title" title={`Tiendas cercanas · Hasta ${props.radiusKm} km`} />}
    {searching && hasLocality && <StoreSearchResults {...props.localityStoreSearch} id="locality-store-search-title" title={props.hasLocation ? `También tiendas en ${props.locality}` : `Tiendas en ${props.locality}`} description={props.hasLocation ? "Comercios de tu localidad que todavía no tienen distancia verificada." : "Explorás por localidad y provincia, sin distancias calculadas."} localityMatch />}
    {searching && hasScope && <div className={styles.productHeading}><h3>Productos</h3><p>El radio se aplica a resultados con distancia calculable. Los demás filtros y el orden se aplican a los productos.</p></div>}

    <div className="catalog-toolbar"><QuickFilters active={props.filters} onToggle={props.onToggleFilter} hasLocation={props.hasLocation} /><label className="sort-select"><ArrowDownUp size={14} /><span className="sr-only">Ordenar productos</span><select value={props.sort} onChange={event => props.onSort(event.target.value as SortOrder)}><option value="recommended">Disponibilidad y relevancia</option><option value="distance" disabled={!props.hasLocation}>{props.hasLocation ? "Más cerca" : "Más cerca · activá tu ubicación"}</option><option value="price">Menor precio</option></select></label></div>
    {!props.hasLocation && <p className="catalog-location-prompt"><MapPin size={16} aria-hidden="true" /><span>{hasLocality ? "Estás explorando por localidad. Usá tu ubicación para conocer distancias y cobertura de envío." : "Usá tu ubicación para mostrarte productos y comercios cerca tuyo."}</span><button className="secondary-link" onClick={props.onLocation}>Usar mi ubicación</button></p>}
    <div className="results-line"><span>{hasScope ? "Resultados de productos" : "Elegí tu ubicación para ver resultados cercanos"}{props.query && ` para “${props.query}”`}{props.category && ` · ${props.category}`}</span><button onClick={props.onReset}>Limpiar filtros <X size={12} /></button></div>

    {props.hasLocation && <section className={localityStyles.group} aria-labelledby="geographic-products-title" aria-busy={props.loading}>
      <div className={localityStyles.groupHeading}><div><h3 id="geographic-products-title"><MapPin size={18} aria-hidden="true" />Cerca tuyo · Hasta {props.radiusKm} km</h3></div><span className={localityStyles.count} role="status">{props.loading ? "Cargando productos..." : props.error ? "Productos no disponibles en este momento" : `${props.total} ${props.total === 1 ? "producto" : "productos"} dentro de ${props.radiusKm} km`}</span></div>
      {props.error && <div className={localityStyles.notice}><p role="alert">{props.error}</p><button className="secondary-link" onClick={props.onRetry}>Reintentar productos cercanos</button></div>}
      {props.loading && <ProductSkeletonGrid />}
      {!props.loading && !props.error && props.products.length > 0 && <div className="product-grid">{props.products.map(product => <ProductCard key={product.id} product={product} saved={props.favorites.includes(product.id)} onSave={props.onSave} />)}</div>}
      {!props.loading && !props.error && props.total === 0 && !globallyEmpty && <div className={localityStyles.notice}><p>{localityTotal > 0 ? `No encontramos productos con distancia verificada dentro de ${props.radiusKm} km, pero sí hay comercios de tu localidad.` : `No encontramos productos con distancia verificada dentro de ${props.radiusKm} km.`}</p>{!props.favoritesOnly && <Link className="secondary-link" href={requestHref}>Crear Pedido Abierto</Link>}</div>}
      {!props.loading && !props.error && <CatalogPagination total={props.total} pageSize={props.pageSize} page={props.page} onPage={props.onPage} label="Páginas de productos dentro del radio" />}
    </section>}

    {showLocalityGroup && <section className={`${localityStyles.group} ${props.hasLocation ? localityStyles.localityGroup : ""}`} aria-labelledby="locality-products-title" aria-busy={local.loading}>
      <div className={localityStyles.groupHeading}><div><h3 id="locality-products-title"><Store size={18} aria-hidden="true" />{props.hasLocation ? `También en ${props.locality}` : `Productos en ${props.locality}`}</h3><p className={localityStyles.description}>{props.hasLocation ? "Comercios de tu localidad que todavía no tienen distancia verificada." : "Explorás por localidad y provincia. Estos resultados no están comprobados dentro del radio seleccionado."}</p></div><span className={localityStyles.count} role="status">{local.loading ? "Cargando productos de tu localidad..." : local.error ? "Productos de tu localidad no disponibles" : `${local.total} ${local.total === 1 ? "producto" : "productos"}${props.hasLocation ? local.total === 1 ? " adicional" : " adicionales" : ""} en ${props.locality}${props.hasLocation ? " sin distancia verificada" : ""}`}</span></div>
      {local.error && <div className={localityStyles.notice}><p role="alert">{local.error}</p><button className="secondary-link" onClick={local.retry}>Reintentar productos de tu localidad</button></div>}
      {local.loading && <ProductSkeletonGrid />}
      {!local.loading && !local.error && local.products.length > 0 && <div className="product-grid">{local.products.map(product => <ProductCard key={product.id} product={product} saved={props.favorites.includes(product.id)} onSave={props.onSave} localityMatch />)}</div>}
      {!local.loading && !local.error && local.total === 0 && <p className={localityStyles.notice}>No encontramos productos en tu localidad con estos filtros.</p>}
      {!local.loading && !local.error && <CatalogPagination total={local.total} pageSize={local.pageSize} page={props.localityPage} onPage={props.onLocalityPage} label="Páginas de productos de tu localidad" />}
    </section>}

    {globallyEmpty && <div className={`empty-state ${radiusStyles.emptyState}`}>{props.favoritesOnly ? <Heart size={30} /> : <Search size={30} />}<h3>{props.favoritesOnly ? "Tus favoritos tienen un lugar acá" : props.hasLocation ? `No encontramos ${noStoreResults ? "resultados" : "productos"} dentro de ${props.radiusKm} km.` : `No encontramos productos en ${props.locality}.`}</h3><p>{props.favoritesOnly ? "Guardá productos con el corazón o quitá filtros para ver tus guardados." : "¿No lo encontraste cerca? Preguntale a comercios cercanos."}</p><div className={radiusStyles.emptyActions}>{!props.favoritesOnly && props.hasLocation && props.radiusKm < 50 && <button type="button" className="outline-button" onClick={() => props.onRadius(50)}>Ampliar a 50 km</button>}{!props.favoritesOnly && <Link className="primary-button" href={requestHref}>📢 Crear Pedido Abierto</Link>}</div><button className={`secondary-link empty-reset ${radiusStyles.emptyReset}`} onClick={props.onReset}>Limpiar filtros de productos</button></div>}
    <p className="demo-note">Disponibilidad informada por cada comercio. Consultá antes de acercarte. Distancias aproximadas en línea recta; los resultados por localidad no garantizan distancia ni cobertura de envío.</p>
  </section>;
}

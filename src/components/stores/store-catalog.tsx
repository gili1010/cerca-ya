"use client";

import { useState } from "react";
import { PackageOpen, Search, X } from "lucide-react";
import type { Product } from "@/lib/products";
import { normalize } from "@/lib/catalog";
import { businessDistance } from "@/lib/distance";
import { useUserLocation } from "../location/user-location-provider";
import { useDemo } from "../demo-provider";
import { ProductCard } from "../home/product-card";
import styles from "./store.module.css";

export function StoreCatalog({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const { coordinates } = useUserLocation();
  const { favorites, toggleFavorite } = useDemo();
  const categoryMap = new Map<string, NonNullable<Product["database"]>["category"]>();
  for (const product of products) {
    const category = product.database?.category;
    if (category) categoryMap.set(category.id, category);
  }
  const categories = [...categoryMap.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const term = normalize(query);
  const visible = products.filter(product => (!categoryId || product.database?.category.id === categoryId)
    && normalize(`${product.name} ${product.database?.product.brand ?? ""} ${product.database?.product.model ?? ""}`).includes(term));

  function reset() { setQuery(""); setCategoryId(""); }

  return <section className={styles.catalog} id="productos" aria-labelledby="store-products-title">
    <div className={styles.catalogHeading}>
      <div><span className="eyebrow">EXPLORÁ ESTA TIENDA</span><h2 id="store-products-title">Productos</h2></div>
      <p>{products.length} {products.length === 1 ? "producto publicado" : "productos publicados"}</p>
    </div>
    {products.length > 0 ? <>
      <div className={styles.toolbar}>
        <label className={styles.search}><span className={styles.searchLabel}>Buscar en esta tienda</span>
          <span className={styles.searchInput}><Search size={20} aria-hidden="true" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en esta tienda" maxLength={160} /></span>
        </label>
        {(query || categoryId) && <button className={`outline-button ${styles.reset}`} onClick={reset}><X size={16} aria-hidden="true" />Limpiar filtros</button>}
      </div>
      {categories.length > 1 && <div className={styles.filters} role="group" aria-label="Filtrar productos por categoría">
        <button className={`filter-chip ${!categoryId ? "selected" : ""}`} aria-pressed={!categoryId} onClick={() => setCategoryId("")}>Todas</button>
        {categories.map(category => <button key={category.id} className={`filter-chip ${categoryId === category.id ? "selected" : ""}`} aria-pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
      </div>}
      <p className={styles.results} role="status">{visible.length} {visible.length === 1 ? "producto" : "productos"}{term && ` para “${query.trim()}”`}</p>
      {visible.length > 0 ? <div className={`product-grid ${styles.grid}`}>
        {visible.map(product => <ProductCard key={product.id} product={{ ...product, distanceKm: businessDistance(coordinates, product.database?.business) }} saved={favorites.includes(product.id)} onSave={toggleFavorite} />)}
      </div> : <div className="empty-state"><Search size={30} aria-hidden="true" /><h3>No encontramos productos con esos filtros</h3><p>Probá otro nombre o elegí otra categoría de esta tienda.</p><button className="primary-button" onClick={reset}>Ver todos los productos</button></div>}
      <p className={styles.note}>Stock informado por el comercio. Consultá la disponibilidad antes de acercarte.</p>
    </> : <div className="empty-state"><PackageOpen size={36} aria-hidden="true" /><h3>Esta tienda todavía no tiene productos publicados</h3><p>Podés consultar al comercio mediante los datos de contacto disponibles arriba.</p></div>}
  </section>;
}

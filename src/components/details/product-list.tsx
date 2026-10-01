"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { type Product } from "@/lib/products";
import { normalize } from "@/lib/catalog";
import { ProductCard } from "../home/product-card";
import { useDemo } from "../demo-provider";

export function ProductList({ products, filterable = false }: { products: Product[]; filterable?: boolean }) {
  const { favorites, toggleFavorite } = useDemo();
  const [query, setQuery] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);
  const visible = products.filter(product => normalize(product.name).includes(normalize(query)) && (!todayOnly || product.pickupToday || product.deliveryToday));
  return <>
    {filterable && <div className="store-catalog-toolbar"><label className="store-search"><Search size={18} /><input aria-label="Buscar en este comercio" value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar en este comercio..." /></label><button className={`filter-chip ${todayOnly ? "selected" : ""}`} aria-pressed={todayOnly} onClick={() => setTodayOnly(!todayOnly)}>Disponible hoy</button><span role="status">{visible.length} productos</span></div>}
    <div className="product-grid">{visible.map(product => <ProductCard key={product.id} product={product} saved={favorites.includes(product.id)} onSave={toggleFavorite} />)}</div>
    {visible.length === 0 && <div className="empty-state"><Search size={25} /><h3>No hay productos con esos filtros</h3><p>Probá otra búsqueda o incluí los productos disponibles desde mañana.</p><button className="primary-button" onClick={() => { setQuery(""); setTodayOnly(false); }}>Ver todos los productos</button></div>}
  </>;
}

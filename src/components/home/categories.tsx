"use client";

import { useState } from "react";
import { CarFront, ChefHat, ChevronRight, Grid2X2, Hammer, House, Laptop, Palette, PawPrint, Shirt, Sparkles, Utensils, Wrench, Zap } from "lucide-react";
import type { CategoryRow } from "@/types/database";
import styles from "./home-upper.module.css";
import homeStyles from "./home-discovery.module.css";

const icons: Record<string, typeof Wrench> = { ferreteria: Wrench, automotor: CarFront, tecnologia: Laptop, hogar: House, indumentaria: Shirt, mascotas: PawPrint, bazar: Utensils, gastronomia: ChefHat, limpieza: Sparkles, artesanias: Palette, herramientas: Hammer, electricidad: Zap };

export function Categories({ categories, selected, onChange, loading, error, onRetry }: { categories: CategoryRow[]; selected: string; onChange: (category: string) => void; loading: boolean; error: string; onRetry: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const featured = expanded ? categories : categories.filter((category, index) => index < 8 || category.slug === selected);
  return <section className={`categories ${styles.categories}`} aria-labelledby="category-title">
    <div className={homeStyles.categoryHeading}><div><h2 id="category-title">Explorá por categorías</h2><p>Productos de comercios y artículos de particulares. Los servicios tienen sus propias especialidades.</p></div>{categories.length > 8 && <button type="button" aria-expanded={expanded} aria-controls="home-category-list" onClick={() => setExpanded(value => !value)}>{expanded ? "Ver menos" : "Ver todas"}<ChevronRight size={15} aria-hidden="true"/></button>}</div>
    {loading && <div role="status"><span className="sr-only">Cargando categorías...</span><div className={homeStyles.categoryLoading} aria-hidden="true">{[0,1,2,3].map(value => <span key={value} className="skeleton"/>)}</div></div>}{error && <p role="alert">{error} <button type="button" className="secondary-link" onClick={onRetry}>Reintentar</button></p>}
    {!loading && !error && !categories.length && <p>No hay categorías disponibles en este momento. Podés seguir buscando por nombre.</p>}
    <div id="home-category-list" className={`category-grid ${styles.categoryGrid}`}>{featured.map(category => { const Icon = icons[category.slug] ?? Grid2X2; return <button type="button" key={category.id} className={`category-card ${styles.categoryCard} ${selected === category.slug ? "selected" : ""}`} data-category={category.slug} aria-pressed={selected === category.slug} onClick={() => onChange(selected === category.slug ? "" : category.slug)}><span className={styles.categoryIcon}><Icon size={31} strokeWidth={1.65} aria-hidden="true" /></span><strong className={styles.categoryName}>{category.name}</strong></button>; })}</div>
  </section>;
}

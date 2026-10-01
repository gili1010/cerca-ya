import { CarFront, ChevronRight, Grid2X2, House, Laptop, PawPrint, Shirt, Utensils, Wrench } from "lucide-react";
import type { CategoryRow } from "@/types/database";

const icons: Record<string, typeof Wrench> = { ferreteria: Wrench, automotor: CarFront, tecnologia: Laptop, hogar: House, indumentaria: Shirt, mascotas: PawPrint, bazar: Utensils };

export function Categories({ categories, selected, onChange, loading, error, onRetry }: { categories: CategoryRow[]; selected: string; onChange: (category: string) => void; loading: boolean; error: string; onRetry: () => void }) {
  return <section className="categories" aria-labelledby="category-title">
    <div className="section-heading"><h2 id="category-title">Lo que necesitás, por acá.</h2><button onClick={() => onChange("")}>Ver todo <ChevronRight size={15} /></button></div>
    {loading && <p role="status">Cargando categorías...</p>}{error && <p role="alert">{error} <button className="secondary-link" onClick={onRetry}>Reintentar</button></p>}
    <div className="category-grid">{categories.map(category => { const Icon = icons[category.slug] ?? Grid2X2; return <button key={category.id} className={`category-card ${selected === category.slug ? "selected" : ""}`} aria-pressed={selected === category.slug} onClick={() => onChange(selected === category.slug ? "" : category.slug)}><span><Icon size={25} strokeWidth={1.65} /></span>{category.name}</button>; })}</div>
  </section>;
}

"use client";

import { useId, type ReactNode } from "react";
import { Check, ChevronLeft, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import type { SearchNavigation } from "@/lib/search-navigation";
import styles from "./search-experience.module.css";

export function SearchDomains({ value, onChange }: { value: SearchNavigation["domain"] | null; onChange: (value: SearchNavigation["domain"]) => void }) {
  return <div className={styles.domains} role="group" aria-label="Tipo de resultados">{([["all","Todo"],["businesses","Comercios"],["personal","Particulares"],["services","Servicios"]] as const).map(([key,label]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => onChange(key)}>{value === key && <Check size={16} aria-hidden="true"/>}{label}</button>)}</div>;
}

export function FilterPanel({ title, children, collapsible = false, expanded = false }: { title: string; children: ReactNode; collapsible?: boolean; expanded?: boolean }) {
  const id = useId();
  const fields = <fieldset className={styles.filters} aria-describedby={id}><legend><SlidersHorizontal size={16} aria-hidden="true"/>{title}</legend><p id={id} className={styles.filterHint}>Los cambios se aplican al elegir cada filtro.</p>{children}</fieldset>;
  return collapsible ? <details open={expanded || undefined} className={styles.filterDisclosure}><summary>{title}<SlidersHorizontal size={17} aria-hidden="true"/></summary>{fields}</details> : fields;
}

export function ActiveFilters({ label, items, onClear }: { label: string; items: { key: string; label: string; onRemove: () => void }[]; onClear?: () => void }) {
  if (!items.length) return null;
  return <div className={styles.activeFilters} role="group" aria-label={label}><span>{label}</span>{items.map(item => <button key={item.key} type="button" onClick={item.onRemove} aria-label={`Quitar filtro: ${item.label}`}>{item.label}<X size={14} aria-hidden="true"/></button>)}{onClear && <button type="button" className={styles.clearAll} onClick={onClear}>Limpiar filtros</button>}</div>;
}

export function SearchPagination({ page, pageSize, total, onPage, label }: { page: number; pageSize: number; total: number; onPage: (page: number) => void; label: string }) {
  if (total <= pageSize) return null;
  const pages = Math.ceil(total / pageSize);
  return <nav className={styles.pagination} aria-label={label}><button type="button" className="outline-button" disabled={page === 0} onClick={() => onPage(page - 1)}><ChevronLeft size={17} aria-hidden="true"/>Anterior</button><span aria-live="polite">Página <strong>{page + 1}</strong> de {pages}<small>{total} resultados</small></span><button type="button" className="outline-button" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Siguiente<ChevronRight size={17} aria-hidden="true"/></button></nav>;
}

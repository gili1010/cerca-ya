import { Check, CircleCheck, Store, Truck, Zap } from "lucide-react";
import { type QuickFilter } from "@/lib/products";

const filters = [
  { id: "today", label: "Hoy", icon: Zap },
  { id: "delivery", label: "Con envío", icon: Truck }, { id: "pickup", label: "Retiro", icon: Store },
  { id: "confirmed", label: "Disponibilidad confirmada", icon: CircleCheck },
] satisfies { id: QuickFilter; label: string; icon: typeof Check }[];

export function QuickFilters({ active, onToggle, hasLocation, mode = "all" }: { active: QuickFilter[]; onToggle: (filter: QuickFilter) => void; hasLocation: boolean; mode?: "all" | "primary" | "secondary" }) {
  return <div className="quick-filters" role="group" aria-label="Filtros rápidos">
    {filters.filter(item => mode === "all" || (mode === "primary" ? item.id === "today" || item.id === "confirmed" : item.id === "delivery" || item.id === "pickup")).map(({ id, label, icon: Icon }) => <button type="button" className={`filter-chip ${active.includes(id) ? "selected" : ""}`} key={id} disabled={id === "delivery" && !hasLocation} title={id === "delivery" && !hasLocation ? "Activá tu ubicación para comprobar la cobertura de envío." : undefined} aria-pressed={active.includes(id)} onClick={() => onToggle(id)}><Icon size={15} aria-hidden="true"/>{label}{active.includes(id) && <Check size={13} aria-hidden="true"/>}</button>)}
  </div>;
}

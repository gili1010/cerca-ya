import { Check, CircleCheck, MapPin, Store, Truck, Zap } from "lucide-react";
import { type QuickFilter } from "@/lib/products";

const filters = [
  { id: "today", label: "Hoy", icon: Zap }, { id: "nearby", label: "Menos de 5 km", icon: MapPin },
  { id: "delivery", label: "Con envío", icon: Truck }, { id: "pickup", label: "Retiro", icon: Store },
  { id: "confirmed", label: "Disponibilidad confirmada", icon: CircleCheck },
] satisfies { id: QuickFilter; label: string; icon: typeof Check }[];

export function QuickFilters({ active, onToggle, hasLocation }: { active: QuickFilter[]; onToggle: (filter: QuickFilter) => void; hasLocation: boolean }) {
  return <div className="quick-filters" role="group" aria-label="Filtros rápidos">
    {filters.map(({ id, label, icon: Icon }) => <button className={`filter-chip ${active.includes(id) ? "selected" : ""}`} key={id} disabled={id === "nearby" && !hasLocation} title={id === "nearby" && !hasLocation ? "Activá tu ubicación para filtrar por distancia." : undefined} aria-pressed={active.includes(id)} onClick={() => onToggle(id)}><Icon size={15} />{label}{active.includes(id) && <Check size={13} />}</button>)}
  </div>;
}

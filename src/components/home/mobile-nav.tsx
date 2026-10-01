import { ClipboardList, Heart, House, Search, UserRound } from "lucide-react";

export type MobileTab = "home" | "search" | "requests" | "saved" | "account";
const tabs = [
  { id: "home", label: "Inicio", icon: House }, { id: "search", label: "Buscar", icon: Search },
  { id: "requests", label: "Pedidos", icon: ClipboardList }, { id: "saved", label: "Guardados", icon: Heart },
  { id: "account", label: "Cuenta", icon: UserRound },
] as const;

export function MobileNav({ active, savedCount, onSelect }: { active: MobileTab; savedCount: number; onSelect: (tab: MobileTab) => void }) {
  return <nav className="mobile-nav" aria-label="Navegación móvil">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} aria-current={active === id ? "page" : undefined} onClick={() => onSelect(id)}><span><Icon size={21} />{id === "saved" && savedCount > 0 && <small>{savedCount}</small>}</span>{label}</button>)}</nav>;
}

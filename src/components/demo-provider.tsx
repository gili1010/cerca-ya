"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { HomeDialogs, type HomeModal } from "./home/home-dialogs";
import { type MobileTab } from "./home/mobile-nav";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth/auth-provider";
import { loginUrl } from "@/lib/auth/redirect";
import { useUserLocation } from "./location/user-location-provider";

interface DemoContextValue {
  favorites: string[];
  toggleFavorite: (id: string) => void;
  zone: string;
  setModal: Dispatch<SetStateAction<HomeModal>>;
  homeTab: MobileTab;
  setHomeTab: Dispatch<SetStateAction<MobileTab>>;
  businessId: string;
  setBusinessId: Dispatch<SetStateAction<string>>;
}
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useState<{ owner: string; ids: string[] }>({ owner: "", ids: [] });
  const favorites = user && saved.owner === user.id ? saved.ids : [];
  const { coordinates } = useUserLocation();
  const zone = coordinates ? "Tu ubicación actual" : "Usar mi ubicación";
  const [modal, setDialogModal] = useState<HomeModal>(null);
  const setModal: Dispatch<SetStateAction<HomeModal>> = next => {
    const value = typeof next === "function" ? next(modal) : next;
    if (value === "account") { router.push(user ? "/cuenta" : "/login"); return; }
    setDialogModal(value);
  };
  const [homeTab, setHomeTab] = useState<MobileTab>("home");
  const [businessId, setBusinessId] = useState("ferreteria-norte");
  const toggleFavorite = (id: string) => {
    if (!user) { router.push(loginUrl(`/producto/${encodeURIComponent(id)}`)); return; }
    setSaved(current => {
      const ids = current.owner === user.id ? current.ids : [];
      return { owner: user.id, ids: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id] };
    });
  };

  return <DemoContext.Provider value={{ favorites, toggleFavorite, zone, setModal, homeTab, setHomeTab, businessId, setBusinessId }}>
    {children}
    <HomeDialogs modal={modal} onClose={() => setModal(null)} />
  </DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used within DemoProvider");
  return context;
}

"use client";

import { type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../home/header";
import { Footer } from "../home/footer";
import { MobileNav, type MobileTab } from "../home/mobile-nav";
import { useDemo } from "../demo-provider";

export function DetailShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { zone, favorites, setModal, setHomeTab } = useDemo();
  const navigateHome = (tab: MobileTab = "home") => {
    setHomeTab(tab);
    router.push(tab === "saved" ? "/?view=saved#catalogo" : tab === "search" ? "/?view=search" : "/");
  };
  return <>
    <Header zone={zone} onZone={() => setModal("zone")} onAccount={() => setModal("account")} onExplore={() => navigateHome()} onRequests={() => router.push("/pedidos")} onHow={() => setModal("how")} />
    <main className="shell detail-page">{children}</main>
    <div className="shell"><Footer onHow={() => setModal("how")} /></div>
    <MobileNav active="home" savedCount={favorites.length} onSelect={tab => {
      if (tab === "account") setModal("account");
      else if (tab === "requests") router.push("/pedidos");
      else navigateHome(tab);
    }} />
  </>;
}

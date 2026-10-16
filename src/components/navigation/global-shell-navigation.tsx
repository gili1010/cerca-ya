"use client";
import { useRouter } from "next/navigation";
import { useDemo } from "@/components/demo-provider";
import { Header } from "@/components/home/header";
import { MobileNav, type MobileTab } from "@/components/home/mobile-nav";

/** Presentation adapters: keep the existing location/account dialogs and destinations. */
export function GlobalHeader() {
 const router = useRouter(), { zone,setModal } = useDemo();
 return <Header zone={zone} onZone={() => setModal("zone")} onAccount={() => setModal("account")} onExplore={() => router.push("/?view=search#explorador")} onRequests={() => router.push("/pedidos")} onHow={() => setModal("how")}/>;
}
export function GlobalMobileNav() {
 const router = useRouter(), { favorites,setModal,setHomeTab } = useDemo();
 function navigate(tab: MobileTab) {
   if (tab === "account") { setModal("account"); return; }
   if (tab === "requests") { router.push("/pedidos"); return; }
   setHomeTab(tab); router.push(tab === "saved" ? "/?view=saved#catalogo" : tab === "search" ? "/?view=search" : "/");
 }
 return <MobileNav active="home" savedCount={favorites.length} onSelect={navigate}/>;
}

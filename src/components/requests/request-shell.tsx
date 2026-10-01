"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, Radio, Store } from "lucide-react";
import type { ReactNode } from "react";
import { useDemo } from "../demo-provider";
import { Header } from "../home/header";
import { MobileNav } from "../home/mobile-nav";
import { useRequests } from "@/lib/request-store";

export function RequestShell({ children, business = false, realRequests = false }: { children: ReactNode; business?: boolean; realRequests?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const reservationScreen = pathname.includes("/reserva");
  const { zone, setModal, favorites, setHomeTab } = useDemo();
  return <>
    <Header zone={zone} onZone={() => setModal("zone")} onAccount={() => setModal("account")} onExplore={() => router.push("/")} onRequests={() => router.push("/pedidos")} onHow={() => setModal("how")} />
    <main className={`shell workflow ${business ? "workflow-merchant" : "workflow-buyer"}`}>
      <div className="workflow-nav"><Link href={business ? "/pedidos" : "/"}><ArrowLeft size={16} />{business ? "Modo comprador" : "Volver a explorar"}</Link><Link href="/comercio"><Store size={16} />Modo comercio</Link></div>
      <nav className="workflow-sections" aria-label={business ? "Secciones del comercio" : "Tus pedidos y reservas"}>
        {business ? <>
          <Link href="/comercio" aria-current={pathname === "/comercio" ? "page" : undefined}>Panel</Link>
          <Link href="/comercio/mi-negocio">Mi comercio</Link>
          <Link href="/comercio/productos" aria-current={pathname === "/comercio/productos" || pathname.startsWith("/comercio/productos/") ? "page" : undefined}>Mis productos</Link>
          <Link href="/comercio/radar" aria-current={pathname.includes("/radar") || pathname.includes("/oportunidades") ? "page" : undefined}><Radio size={16} aria-hidden="true" />Radar</Link>
          <Link href="/comercio/reservas" aria-current={reservationScreen ? "page" : undefined}>Reservas</Link>
          <span aria-disabled="true">Estadísticas · Próximamente</span>
        </> : <><Link href="/pedidos" aria-current={!reservationScreen ? "page" : undefined}>Mis pedidos</Link><Link href="/reservas" aria-current={reservationScreen ? "page" : undefined}>Mis reservas</Link></>}
      </nav>
      {realRequests ? <p className="workflow-demo">Tus pedidos, Radar, ofertas y reservas se actualizan en vivo. También podés usar Actualizar.</p> : <LocalWorkflowNotice />}
      {children}
    </main>
    <MobileNav active="requests" savedCount={favorites.length} onSelect={tab => {
      if (tab === "account") setModal("account");
      else if (tab === "requests") router.push("/pedidos");
      else { setHomeTab(tab); router.push(tab === "saved" ? "/#catalogo" : "/"); }
    }} />
  </>;
}

function LocalWorkflowNotice() {
  const { storageWarning } = useRequests();
  return <><p className="workflow-demo"><strong>Demo local</strong> Esta pantalla conserva datos de prueba de este navegador. Los pedidos, ofertas y reservas nuevos se guardan en tu cuenta; no se importan a esta demo.</p>{storageWarning && <p className="workflow-warning" role="alert">{storageWarning}</p>}</>;
}




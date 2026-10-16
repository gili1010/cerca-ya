"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ClipboardList, ChevronDown, Heart, PackageCheck, Package, Store, Wrench, Radio, FileText, MessageSquare, CircleHelp } from "lucide-react";
import { SectionHeader } from "@/components/ui/primitives";
import { NavigationItem } from "./navigation-item";
import styles from "./global-navigation.module.css";

const groups = [
 { title: "Mis compras y solicitudes", items: [
   { href: "/pedidos", label: "Mis pedidos", description: "Pedidos abiertos de productos y ofertas", icon: ClipboardList },
   { href: "/reservas", label: "Mis reservas", description: "Seguí tus compras en comercios", icon: PackageCheck },
   { href: "/mis-solicitudes-servicio", label: "Mis solicitudes de servicios", description: "Trabajos que necesitás y propuestas recibidas", icon: Wrench },
   { href: "/guardados", label: "Guardados", description: "Volvé a tus productos favoritos", icon: Heart },
 ] },
 { title: "Lo que ofrezco", items: [
   { href: "/mis-publicaciones", label: "Mis publicaciones", description: "Artículos nuevos y usados", icon: Package },
   { href: "/mis-servicios", label: "Mis servicios", description: "Tus servicios publicados", icon: Wrench },
   { href: "/comercio", label: "Mi comercio", description: "Productos, tienda y gestión comercial", icon: Store },
   { href: "/mi-perfil-profesional", label: "Mi perfil profesional", description: "Presentación y localidades donde trabajás", icon: FileText },
 ] },
 { title: "Encontrá oportunidades", items: [
   { href: "/comercio/radar", label: "Radar comercial", description: "Necesidades de productos para tu comercio", icon: Radio },
   { href: "/radar-servicios", label: "Radar de servicios", description: "Trabajos compatibles con tu cobertura", icon: Radio },
   { href: "/mis-propuestas-servicio", label: "Mis propuestas", description: "Presupuestos que enviaste como profesional", icon: MessageSquare },
 ] },
] as const;

export function ActivityMenu({ mobile = false, active = false, onRequests, onSaved, onHow }: { mobile?: boolean; active?: boolean; onRequests?: () => void; onSaved?: () => void; onHow?: () => void }) {
 const path = usePathname(), ref = useRef<HTMLDetailsElement>(null);
 function close() { if (ref.current) ref.current.open = false; }
 useEffect(() => {
   const outside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target)) close(); };
   const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { close(); ref.current.querySelector("summary")?.focus(); } };
   document.addEventListener("pointerdown",outside); document.addEventListener("keydown",escape);
   return () => { document.removeEventListener("pointerdown",outside); document.removeEventListener("keydown",escape); };
 }, []);
 useEffect(() => { close(); }, [path]);
 return <details ref={ref} className={`${styles.menu} ${mobile ? styles.mobileMenu : ""}`}><summary className={`${mobile ? styles.bottomItem : styles.topItem} ${active ? styles.active : ""}`} aria-label="Actividad: abrir mis compras, publicaciones y oportunidades"><span className={styles.navIcon}><ClipboardList size={mobile ? 21 : 17} aria-hidden="true"/></span><span>Actividad</span>{!mobile && <ChevronDown size={13} aria-hidden="true"/>}</summary>
   <div className={styles.menuPanel}><div className={styles.menuIntro}><strong>Tu actividad en CercaYa</strong><p>Comprá, ofrecé y encontrá oportunidades con la misma cuenta.</p></div>
     {groups.map(group => <section key={group.title} className={styles.menuGroup}><SectionHeader level={3} title={group.title}/>{group.items.map(item => {
       const callback = item.href === "/pedidos" ? onRequests : item.href === "/guardados" ? onSaved : undefined;
       return callback ? <button type="button" key={item.href} className={styles.menuItem} onClick={() => { close(); callback(); }}><span className={styles.itemIcon}><item.icon size={19} aria-hidden="true"/></span><span><strong>{item.label}</strong><small>{item.description}</small></span></button> : <NavigationItem key={item.href} {...item} active={path === item.href || (path.startsWith(`${item.href}/`) && item.href !== "/comercio")} onNavigate={close}/>;
     })}</section>)}
     <section className={styles.menuGroup}><SectionHeader level={3} title="Necesito algo"/><NavigationItem href="/pedido/nuevo" label="Necesito un producto" description="Publicá un Pedido Abierto" icon={Package} onNavigate={close}/><NavigationItem href="/necesito-un-servicio" label="Necesito un servicio" description="Contá qué trabajo necesitás" icon={Wrench} onNavigate={close}/></section>
     {onHow && <button className={styles.helpLink} type="button" onClick={() => { close(); onHow(); }}><CircleHelp size={17} aria-hidden="true"/>Cómo funciona CercaYa</button>}
     <button className={styles.closeMenu} type="button" onClick={() => { close(); ref.current?.querySelector("summary")?.focus(); }}>Cerrar menú</button>
   </div>
 </details>;
}

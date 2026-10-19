"use client";

import Link from "next/link";
import { useEffect, useId, useRef } from "react";
import { usePathname } from "next/navigation";
import { ClipboardList, ChevronDown, ChevronRight, Heart, PackageCheck, Package, Store, Wrench, Radio, MessageSquare, CircleHelp, LogIn, UserRound, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useMyBusiness } from "@/components/businesses/business-provider";
import { loginUrl } from "@/lib/auth/redirect";
import { NavigationItem } from "./navigation-item";
import styles from "./global-navigation.module.css";

export function ActivityMenu({ mobile = false, active = false, entry = false, onRequests, onSaved, onHow }: { mobile?: boolean; active?: boolean; entry?: boolean; onRequests?: () => void; onSaved?: () => void; onHow?: () => void }) {
 const path = usePathname(), ref = useRef<HTMLDetailsElement>(null), titleId = useId();
 const { user, loading } = useAuth();
 const { business, loading: businessLoading, error: businessError } = useMyBusiness();
 const knownBusiness = !businessLoading && !businessError && business;
 const knownNoBusiness = !businessLoading && !businessError && !business;
 const groups = [
  { title: "Mis compras y pedidos", collapsible: false, items: [
   { href: "/reservas", label: "Mis reservas", description: "Estado e historial de tus pedidos a comercios", icon: PackageCheck },
   { href: "/pedidos", label: "Mis pedidos de productos", description: "Lo que buscás y las ofertas que recibiste", icon: ClipboardList },
   { href: "/guardados", label: "Guardados", description: "Productos que querés volver a ver", icon: Heart },
  ] },
  { title: "Trabajos que necesito", collapsible: false, items: [
   { href: "/mis-solicitudes-servicio", label: "Mis solicitudes de servicios", description: "Tus trabajos solicitados y propuestas recibidas", icon: Wrench },
  ] },
  { title: "Lo que publico", collapsible: true, items: [
   { href: "/mis-publicaciones", label: "Mis publicaciones", description: "Artículos particulares que publicaste para vender", icon: Package },
   { href: "/mis-servicios", label: "Mis servicios", description: "Administrá los trabajos que ofrecés o empezá a ofrecer", icon: Wrench },
   { href: knownNoBusiness ? "/comercio/crear" : "/comercio", label: knownNoBusiness ? "Crear mi tienda" : "Mi comercio", description: knownBusiness ? knownBusiness.name : "Tu tienda y gestión comercial", icon: Store },
   ...(knownBusiness ? [
    { href: "/comercio/productos", label: "Productos de mi comercio", description: "Tu catálogo comercial", icon: Package },
    { href: "/comercio/reservas", label: "Reservas de mi comercio", description: "Pedidos que recibís como comerciante", icon: PackageCheck },
   ] : []),
  ] },
  { title: "Oportunidades y respuestas", collapsible: true, items: [
   { href: "/radar-servicios", label: "Radar de servicios", description: "Trabajos que buscan profesionales en tu cobertura", icon: Radio },
   { href: "/mis-propuestas-servicio", label: "Mis propuestas enviadas", description: "Las respuestas que enviaste como profesional", icon: MessageSquare },
   { href: "/comercio/radar", label: "Radar comercial", description: knownNoBusiness ? "Requiere un comercio: podés comenzar creando tu tienda" : "Pedidos de productos y acceso a tus ofertas disponibles", icon: Radio },
  ] },
 ];
 const selected = (href: string) => path === href || (href !== "/comercio" && path.startsWith(`${href}/`));
 function close(restore = false) { if (ref.current) { ref.current.open = false; if (restore) ref.current.querySelector("summary")?.focus(); } }
 useEffect(() => {
  const outside = (event: PointerEvent) => { if (event.target instanceof Node && !ref.current?.contains(event.target)) close(); };
  const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && ref.current?.open) { event.preventDefault(); close(true); } };
  document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
  return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
 }, []);
 useEffect(() => { close(); }, [path, user?.id]);
 return <details ref={ref} data-activity-menu className={`${styles.menu} ${mobile ? styles.mobileMenu : ""} ${entry ? styles.accountActivity : ""}`}
  onToggle={event => { if (event.currentTarget.open) document.querySelectorAll<HTMLDetailsElement>("details[data-activity-menu]").forEach(menu => { if (menu !== event.currentTarget) menu.open = false; }); }}
  onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close(); }}>
  <summary className={`${entry ? styles.activityEntry : mobile ? styles.bottomItem : styles.topItem} ${active ? styles.active : ""}`} aria-label={entry ? "Abrir Mi actividad" : "Actividad: abrir mis compras, publicaciones y oportunidades"}>
   <span className={styles.navIcon}><ClipboardList size={mobile ? 21 : 18} aria-hidden="true"/></span><span>{entry ? "Ver mi actividad" : "Actividad"}</span>{!mobile && <ChevronDown size={14} aria-hidden="true"/>}
  </summary>
  <div className={styles.menuPanel} aria-labelledby={titleId}>
   <div className={styles.menuIntro}><div><h2 id={titleId}>Mi actividad</h2><p>Encontrá tus publicaciones, pedidos y oportunidades</p></div><button type="button" className={styles.activityClose} aria-label="Cerrar Mi actividad" onClick={() => close(true)}><X size={20} aria-hidden="true"/></button></div>
   {loading ? <p role="status" className={styles.menuStatus}>Comprobando tu sesión…</p> : !user ? <div className={styles.activityGuest}>
    <LogIn size={28} aria-hidden="true"/><h3>Ingresá para ver tu actividad</h3><p>Consultá tus publicaciones, reservas y solicitudes desde tu cuenta.</p>
    <Link className="primary-button" href={loginUrl("/cuenta")} onClick={() => close()}>Iniciar sesión</Link><Link className="outline-button" href="/registro?redirect=%2Fcuenta" onClick={() => close()}>Crear cuenta</Link><p>Al ingresar, abrí Mi actividad desde tu cuenta o la navegación.</p>
   </div> : <>
    {groups.map(group => {
     const content = group.items.map(item => {
      const callback = item.href === "/pedidos" ? onRequests : item.href === "/guardados" ? onSaved : undefined;
      return callback ? <button type="button" key={item.href} className={styles.menuItem} onClick={() => { close(true); callback(); }}><span className={styles.itemIcon}><item.icon size={19} aria-hidden="true"/></span><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight className={styles.itemArrow} size={16} aria-hidden="true"/></button> : <NavigationItem key={item.href} {...item} active={selected(item.href)} onNavigate={() => close()}/>;
     });
     return group.collapsible ? <details key={group.title} className={styles.activityGroup} open={group.items.some(item => selected(item.href)) || undefined}><summary><h3>{group.title}</h3><ChevronDown size={16} aria-hidden="true"/></summary>{content}</details> : <section key={group.title} className={styles.menuGroup}><h3>{group.title}</h3>{content}</section>;
    })}
    <div className={styles.activityFooter}><NavigationItem href="/publicar" label="Publicar algo nuevo" description="Ofrecer un artículo, un servicio o pedir lo que necesitás" icon={Package} onNavigate={() => close()}/>{path!=="/cuenta"&&<NavigationItem href="/cuenta" label="Mi cuenta" description="Datos personales y configuración" icon={UserRound} onNavigate={() => close()}/>}</div>
   </>}
   {onHow && <button className={styles.helpLink} type="button" onClick={() => { close(); onHow(); }}><CircleHelp size={17} aria-hidden="true"/>Cómo funciona CercaYa</button>}
   <button className={styles.closeMenu} type="button" onClick={() => close(true)}>Cerrar actividad</button>
  </div>
 </details>;
}

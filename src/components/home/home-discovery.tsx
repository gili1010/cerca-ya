import Link from "next/link";
import { ArrowRight, Package, Store, Wrench, MessageSquare } from "lucide-react";
import type { SearchNavigation } from "@/lib/search-navigation";
import { SectionHeader } from "@/components/ui/primitives";
import styles from "./home-discovery.module.css";

const destinations = [
  { domain: "businesses", icon: Store, title: "Productos de comercios", description: "Comprá en negocios de tu zona.", label: "Comercios" },
  { domain: "personal", icon: Package, title: "Artículos de particulares", description: "Encontrá artículos nuevos y usados.", label: "Particulares" },
  { domain: "services", icon: Wrench, title: "Servicios y oficios", description: "Encontrá profesionales que trabajan en tu localidad.", label: "Servicios" },
] as const;

export function DiscoveryEntrances({ onSelect }: { onSelect: (domain: SearchNavigation["domain"]) => void }) {
  return <section className={styles.entrances} aria-labelledby="discovery-title"><h2 id="discovery-title">¿Qué necesitás encontrar?</h2><div className={styles.entranceGrid}>{destinations.map(({ domain, icon: Icon, title, description, label }) => <button type="button" key={domain} className={styles.entrance} onClick={() => onSelect(domain)}><span className={styles.entranceIcon}><Icon size={23} aria-hidden="true"/></span><span><small>{label}</small><strong>{title}</strong><span>{description}</span></span><ArrowRight size={18} aria-hidden="true"/></button>)}</div></section>;
}

export function HomeParticipation({ query }: { query: string }) {
  return <div className={styles.participation}>
    <section className={styles.need} aria-labelledby="need-title"><span className={styles.needIcon}><MessageSquare size={25} aria-hidden="true"/></span><div><h2 id="need-title">¿No encontraste lo que buscabas?</h2><p>Publicá lo que necesitás y conectá con quienes pueden ayudarte.</p><div className={styles.needActions}><Link className="primary-button" href={`/pedido/nuevo?q=${encodeURIComponent(query)}`}>Necesito un producto<ArrowRight size={16} aria-hidden="true"/></Link><Link className="outline-button" href="/necesito-un-servicio">Necesito un servicio<ArrowRight size={16} aria-hidden="true"/></Link></div></div></section>
    <section className={styles.offer}><SectionHeader title="¿Tenés algo para ofrecer?" description="Una cuenta, distintas formas de participar en CercaYa."/><div className={styles.offerLinks}><Link href="/publicar/articulo"><Package size={18} aria-hidden="true"/>Vender un artículo<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/publicar/servicio"><Wrench size={18} aria-hidden="true"/>Ofrecer un servicio<ArrowRight size={16} aria-hidden="true"/></Link><Link href="/comercio/crear"><Store size={18} aria-hidden="true"/>Crear mi tienda<ArrowRight size={16} aria-hidden="true"/></Link></div></section>
  </div>;
}

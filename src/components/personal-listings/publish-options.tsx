import Link from "next/link";
import { ArrowUpRight, Package, Store, Wrench, Check } from "lucide-react";
import styles from "./personal-listings.module.css";

export function PublishOptions() {
  return <><div className={styles.heading}><span className="eyebrow">HAY ALGUIEN CERCA QUE LO NECESITA</span><h1>¿Qué querés publicar?</h1><p>Vendé un artículo o creá la tienda de tu comercio. Elegí cómo querés participar en CercaYa.</p></div>
    <div className={styles.options}><Link className={`${styles.option} ${styles.featured}`} href="/publicar/articulo"><span className={styles.symbol}><Package size={30} aria-hidden="true" /></span><small>PARA PARTICULARES</small><h2>Vender un producto</h2><p>Una bici, un mueble o ese artículo que ya no usás. Nuevo o usado, sin crear una tienda.</p><span className={styles.optionAction}>Publicar mi artículo <ArrowUpRight size={19} aria-hidden="true" /></span></Link>
    <Link className={styles.option} href="/publicar/servicio"><span className={styles.symbol}><Wrench size={30} aria-hidden="true" /></span><small>PARA PROFESIONALES Y OFICIOS</small><h2>Ofrecer un servicio</h2><p>Tu oficio o profesión, al alcance de tu barrio. Sin crear una tienda.</p><span className={styles.optionAction}>Publicar mi servicio <ArrowUpRight size={19} aria-hidden="true" /></span></Link>
    <Link className={styles.option} href="/comercio/crear"><span className={styles.symbol}><Store size={30} aria-hidden="true" /></span><small>PARA COMERCIOS</small><h2>Crear mi tienda</h2><p>Tu comercio online, con catálogo, pedidos y un enlace para compartir.</p><span className={styles.optionAction}>Crear mi tienda <ArrowUpRight size={19} aria-hidden="true" /></span></Link></div>
    <p className={styles.reassurance}><Check size={18} aria-hidden="true" />Una cuenta, distintas formas de participar.</p><Link className="secondary-link" href="/mis-publicaciones">Ver mis publicaciones</Link></>;
}

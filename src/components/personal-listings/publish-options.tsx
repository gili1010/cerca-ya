import Link from "next/link";
import { ArrowUpRight, Package, Store, Wrench, Check, Search, MessageCircle } from "lucide-react";
import styles from "../publish/publish-options.module.css";

const groups = [
  { id: "offer", title: "Quiero ofrecer", description: "Elegí qué querés compartir con tu comunidad.", options: [
    { href: "/publicar/articulo", icon: Package, title: "Vender un artículo", description: "Nuevo o usado, sin crear una tienda.", action: "Publicar mi artículo" },
    { href: "/publicar/servicio", icon: Wrench, title: "Ofrecer un servicio", description: "Tu oficio o profesión, cerca de quienes lo necesitan.", action: "Publicar mi servicio" },
    { href: "/comercio/crear", icon: Store, title: "Crear mi tienda", description: "Un catálogo para tu comercio y un enlace para compartir.", action: "Crear mi tienda" },
  ] },
  { id: "need", title: "Estoy buscando", description: "Si todavía no lo encontraste, contá qué necesitás.", options: [
    { href: "/pedido/nuevo", icon: Search, title: "Necesito un producto", description: "Publicá un pedido para los comercios cercanos.", action: "Pedir un producto" },
    { href: "/necesito-un-servicio", icon: MessageCircle, title: "Necesito un servicio", description: "Describí el trabajo y la localidad donde lo necesitás.", action: "Solicitar un servicio" },
  ] },
];

export function PublishOptions() {
  return <div className={styles.page}>
    <header className={styles.heading}><span className="eyebrow">PARTICIPÁ EN TU COMUNIDAD</span><h1>¿Qué querés publicar?</h1><p>Ofrecé algo o contanos qué necesitás. Elegí por dónde empezar.</p></header>
    {groups.map(group => <section key={group.id} className={styles.group} aria-labelledby={`publish-${group.id}`}>
      <div className={styles.groupHeading}><h2 id={`publish-${group.id}`}>{group.title}</h2><p>{group.description}</p></div>
      <div className={styles.options} data-group={group.id}>{group.options.map(({ icon: Icon, ...option }) => <Link key={option.href} className={styles.option} href={option.href}>
        <span className={styles.symbol}><Icon size={26} aria-hidden="true" /></span><h3>{option.title}</h3><p>{option.description}</p><span className={styles.action}>{option.action}<ArrowUpRight size={18} aria-hidden="true" /></span>
      </Link>)}</div>
    </section>)}
    <div className={styles.footer}><p><Check size={18} aria-hidden="true" />Una cuenta, distintas formas de participar.</p><Link className="secondary-link" href="/mis-publicaciones">Ver mis publicaciones</Link></div>
  </div>;
}

"use client";

import Link from "next/link";
import { ArrowUpRight, ChartNoAxesColumn, Hand, PackageCheck, Radio, Store } from "lucide-react";
import { businesses } from "@/data/businesses";
import { businessCatalog } from "@/lib/radar";
import { useDemo } from "../demo-provider";
import { ProductList } from "../details/product-list";
import { BusinessSelector } from "./business-selector";
import { useMyBusiness } from "../businesses/business-provider";
import { PublishedProductsLink } from "../merchant-products/published-products-link";
import { MerchantStoreCard } from "../stores/merchant-store-card";
import { useAuth } from "../auth/auth-provider";
import styles from "./merchant-workspace.module.css";
import { MerchantOnboarding } from "../onboarding/merchant-onboarding";

export function MerchantWorkspace({ catalog = false }: { catalog?: boolean }) {
  const { profile } = useAuth();
  const { businessId } = useDemo();
  const { business: realBusiness, loading: businessLoading, error: businessError, refresh } = useMyBusiness();
  const business = businesses.find(item => item.id === businessId)!;
  const products = businessCatalog(business);
  const firstName = profile?.full_name.trim().split(/\s+/)[0];
  return <><header className={catalog ? "workflow-heading" : styles.hero}>
    {!catalog && <span className={styles.heroIcon}><Store size={28} aria-hidden="true" /></span>}
    <div className={catalog ? undefined : styles.heroContent}>
      {catalog ? <span className="eyebrow">MI CATÁLOGO</span> : <p className={styles.greeting}><Hand size={20} aria-hidden="true" />{firstName ? `Hola, ${firstName}` : "Hola"}</p>}
      <h1>{catalog ? "Productos de mi catálogo" : realBusiness?.name ?? "Panel del comercio"}</h1>
      <p className={catalog ? undefined : styles.description}>{catalog ? "Tus productos, en un solo lugar." : "Gestioná tu catálogo, oportunidades y reservas desde un solo lugar."}</p>
      {!catalog && businessLoading && <p role="status">Cargando tu comercio…</p>}
      {!catalog && businessError && <p role="alert">{businessError} <button className="secondary-link" onClick={() => void refresh().catch(() => {})}>Reintentar</button></p>}
    </div>
    {!catalog && realBusiness && <Link className={`primary-button ${styles.businessLink}`} href="/comercio/mi-negocio">Ver mi comercio<ArrowUpRight size={17} aria-hidden="true" /></Link>}
  </header>{catalog && <BusinessSelector />}
    {!catalog && realBusiness && !realBusiness.active && <p className="info-note" role="alert">{realBusiness.admin_suspended_at ? "Tu comercio fue suspendido por administración y no está disponible públicamente." : "Tu comercio está inactivo y no está disponible públicamente."}</p>}
    {!catalog && realBusiness && <MerchantOnboarding key={realBusiness.id} business={realBusiness} />}
    {!catalog && realBusiness && <MerchantStoreCard business={realBusiness} />}
    {catalog ? <section className="store-products">{products.length ? <ProductList key={business.id} products={products} filterable /> : <div className="empty-state"><h2>Este comercio no tiene productos publicados</h2><p>Podés responder manualmente a pedidos del Radar.</p><Link className="primary-button" href="/comercio/radar">Abrir Radar</Link></div>}</section> : <div className="radar-panel-links"><PublishedProductsLink /><Link className="panel workspace-radar" href="/comercio/radar"><span className="workspace-icon"><Radio size={24} aria-hidden="true" /></span><strong>Radar CercaYa</strong><span>Pedidos abiertos que podrías resolver</span></Link><Link className="panel" href="/comercio/reservas"><span className="workspace-icon"><PackageCheck size={24} aria-hidden="true" /></span><strong>Reservas</strong><span>Confirmar, preparar y completar</span></Link><div className="panel"><span className="workspace-icon"><ChartNoAxesColumn size={24} aria-hidden="true" /></span><strong>Estadísticas</strong><span>Próximamente</span></div></div>}
  </>;
}



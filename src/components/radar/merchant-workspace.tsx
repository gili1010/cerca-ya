"use client";

import Link from "next/link";
import { ChartNoAxesColumn, PackageCheck, Radio } from "lucide-react";
import { businesses } from "@/data/businesses";
import { businessCatalog } from "@/lib/radar";
import { useDemo } from "../demo-provider";
import { ProductList } from "../details/product-list";
import { BusinessSelector } from "./business-selector";
import { useMyBusiness } from "../businesses/business-provider";
import { PublishedProductsLink } from "../merchant-products/published-products-link";

export function MerchantWorkspace({ catalog = false }: { catalog?: boolean }) {
  const { businessId } = useDemo();
  const { business: realBusiness, loading: businessLoading, error: businessError, refresh } = useMyBusiness();
  const business = businesses.find(item => item.id === businessId)!;
  const products = businessCatalog(business);
  return <><div className="workflow-heading"><span className="eyebrow">{!catalog && realBusiness ? "Hola 👋" : "MODO COMERCIO"}</span><h1>{catalog ? "Productos de mi catálogo" : realBusiness?.name ?? "Panel del comercio"}</h1><p>{catalog ? "Catálogo de prueba conservado para la demo local." : "Encontrá demanda cercana, revisá tus productos y gestioná reservas."}</p>{!catalog && businessLoading && <p role="status">Cargando tu comercio…</p>}{!catalog && businessError && <p role="alert">{businessError} <button className="secondary-link" onClick={() => void refresh().catch(() => {})}>Reintentar</button></p>}{!catalog && realBusiness && <><Link className="secondary-link" href="/comercio/mi-negocio">Ver Mi comercio →</Link><p>Mi comercio, Mis productos, Radar, ofertas y reservas usan datos reales.</p></>}</div>{catalog && <BusinessSelector />}
    {catalog ? <section className="store-products">{products.length ? <ProductList key={business.id} products={products} filterable /> : <div className="empty-state"><h2>Este comercio no tiene productos publicados</h2><p>Podés responder manualmente a pedidos del Radar.</p><Link className="primary-button" href="/comercio/radar">Abrir Radar</Link></div>}</section> : <div className="radar-panel-links"><PublishedProductsLink /><Link className="panel workspace-radar" href="/comercio/radar"><span className="workspace-icon"><Radio size={24} aria-hidden="true" /></span><strong>Radar CercaYa</strong><span>Pedidos abiertos que podrías resolver</span></Link><Link className="panel" href="/comercio/reservas"><span className="workspace-icon"><PackageCheck size={24} aria-hidden="true" /></span><strong>Reservas</strong><span>Confirmar, preparar y completar</span></Link><div className="panel"><span className="workspace-icon"><ChartNoAxesColumn size={24} aria-hidden="true" /></span><strong>Estadísticas</strong><span>Próximamente</span></div></div>}
  </>;
}



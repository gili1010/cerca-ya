import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { DetailShell } from "@/components/details/detail-shell";
import { StoreHeader } from "@/components/stores/store-header";
import { StoreCatalog } from "@/components/stores/store-catalog";
import { loadPublicStore } from "@/lib/public-store-server";
import { StoreCartBar } from "@/components/cart/store-cart-bar";
import styles from "@/components/stores/store.module.css";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { store, error } = await loadPublicStore((await params).slug);
  return {
    title: store ? `${store.business.name} | CercaYa` : "Tienda no disponible | CercaYa",
    description: store ? store.business.description.trim().slice(0, 160) || `Explorá los productos de ${store.business.name} en CercaYa.` : undefined,
    ...(!store || error ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { store, error } = await loadPublicStore(slug);
  if (error) return <DetailShell><section className="empty-state">
    <h1>No pudimos cargar esta tienda.</h1>
    <p>Intentá nuevamente en unos momentos.</p>
    <a className="primary-button" href={`/tienda/${encodeURIComponent(slug)}`}>Reintentar</a>
    <Link className="secondary-link" href="/">Volver a explorar</Link>
  </section></DetailShell>;
  if (!store) notFound();

  return <DetailShell>
    <Link className={styles.backLink} href="/"><ArrowLeft size={16} aria-hidden="true" />Explorar productos</Link>
    <StoreHeader business={store.business} categories={store.categories} />
    <StoreCatalog products={store.products} />
    <StoreCartBar businessId={store.business.id} products={store.products} />
  </DetailShell>;
}

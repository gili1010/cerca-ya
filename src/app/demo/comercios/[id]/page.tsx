import { BackLink } from "@/components/navigation/back-link";
import { notFound } from "next/navigation";
import { Store } from "lucide-react";
import { products, distance } from "@/lib/products";
import { getStore, stores } from "@/lib/stores";
import { DetailShell } from "@/components/details/detail-shell";
import { DemoNotice } from "@/components/details/demo-notice";
import { ProductList } from "@/components/details/product-list";
import { StoreLocation } from "@/components/details/store-location";

export function generateStaticParams() { return stores.map(store => ({ id: store.id })); }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const store = getStore((await params).id);
  if (!store) notFound();
  return <DetailShell><BackLink href="/">Volver a explorar</BackLink><section className="panel workflow-heading store-heading"><Store size={34} /><span className="eyebrow">COMERCIO DEMO · {store.category}</span><h1>{store.name}</h1><p>{store.description}</p><p>{store.neighborhood} · A {distance(store.distanceKm)}</p></section><section className="store-products"><h2>Productos de este comercio</h2><ProductList products={products.filter(product => product.storeId === store.id)} filterable /></section><StoreLocation store={store} /><DemoNotice /></DetailShell>;
}

import Link from "next/link";
import { DetailShell } from "@/components/details/detail-shell";
import { PublicProductDetail } from "@/components/details/public-product-detail";
import { loadPublicProduct } from "@/lib/public-product-server";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { product } = await loadPublicProduct((await params).id);
  return { title: product ? `${product.name} | CercaYa` : "Producto no disponible | CercaYa" };
}
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { product, error } = await loadPublicProduct(id);
  return <DetailShell>{error ? <section className="empty-state"><h1>No pudimos cargar el producto en este momento.</h1><a className="primary-button" href={`/producto/${encodeURIComponent(id)}`}>Reintentar</a></section> : !product ? <section className="empty-state"><h1>Producto no disponible.</h1><Link className="primary-button" href="/">Volver a explorar</Link></section> : <PublicProductDetail product={product} />}</DetailShell>;
}

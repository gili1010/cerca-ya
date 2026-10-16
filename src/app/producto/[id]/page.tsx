import { BackLink } from "@/components/navigation/back-link";
import { DetailShell } from "@/components/details/detail-shell";
import { PublicProductDetail } from "@/components/details/public-product-detail";
import { loadPublicProduct } from "@/lib/public-product-server";
import { personalSearchReturnTo } from "@/lib/search-navigation";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { product } = await loadPublicProduct((await params).id);
  return { title: product ? `${product.name} | CercaYa` : "Producto no disponible | CercaYa" };
}
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const { id } = await params;
  const rawReturn = (await searchParams).returnTo;
  const returnTo = personalSearchReturnTo(typeof rawReturn === "string" ? rawReturn : null);
  const { product, error } = await loadPublicProduct(id);
  return <DetailShell>{error ? <section className="empty-state"><h1>No pudimos cargar el producto en este momento.</h1><a className="primary-button" href={`/producto/${encodeURIComponent(id)}?returnTo=${encodeURIComponent(returnTo)}`}>Reintentar</a></section> : !product ? <section className="empty-state"><h1>Producto no disponible.</h1><BackLink href={returnTo}>Volver a explorar</BackLink></section> : <PublicProductDetail product={product} returnTo={returnTo} />}</DetailShell>;
}


import Link from "next/link";
import { isProductUuid } from "@/lib/public-catalog";
import { loadPublicProduct } from "@/lib/public-product-server";
import { RequestShell } from "@/components/requests/request-shell";
import { ReservationForm } from "@/components/reservations/reservation-form";
import { requireUser } from "@/lib/auth/server";
import { RequireAuth } from "@/components/auth/require-auth";
export const metadata = { title: "Reservar producto | CercaYa" };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ entrega?: string | string[] }> }) {
  const { id } = await params;
  const { entrega } = await searchParams;
  const returnTo = `/producto/${encodeURIComponent(id)}/reservar${entrega === "delivery" ? "?entrega=delivery" : ""}`;
  await requireUser(returnTo);
  const result = isProductUuid(id) ? await loadPublicProduct(id) : { product: null, error: false };
  return <RequestShell realRequests><RequireAuth returnTo={returnTo}>{result.error ? <section className="empty-state"><h1>No pudimos cargar el producto.</h1><a className="primary-button" href={returnTo}>Reintentar</a></section> : !result.product ? <section className="empty-state"><h1>Este producto ya no está disponible.</h1><Link className="primary-button" href="/">Volver a explorar</Link></section> : <ReservationForm product={result.product} initialDeliveryType={entrega === "delivery" ? "delivery" : "pickup"} />}</RequireAuth></RequestShell>;
}

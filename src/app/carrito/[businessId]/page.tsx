import { DetailShell } from "@/components/details/detail-shell";
import { CartView } from "@/components/cart/cart-view";

export const metadata = { title: "Tu pedido | CercaYa", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  return <DetailShell><CartView businessId={businessId} /></DetailShell>;
}

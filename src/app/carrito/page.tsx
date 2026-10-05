import { DetailShell } from "@/components/details/detail-shell";
import { CartIndexView } from "@/components/cart/cart-view";

export const metadata = { title: "Tus pedidos en preparación | CercaYa", robots: { index: false, follow: false } };

export default function Page() {
  return <DetailShell><CartIndexView /></DetailShell>;
}

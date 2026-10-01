// Explicit legacy screen for local offers. Never used as a fallback for real UUIDs.
import { RequestShell } from "@/components/requests/request-shell";
import { RequestDetail } from "@/components/requests/request-detail";
export const metadata = { title: "Pedido de prueba local | CercaYa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <RequestShell><RequestDetail id={(await params).id} /></RequestShell>;
}

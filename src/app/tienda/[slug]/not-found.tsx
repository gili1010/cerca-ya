import Link from "next/link";
import { Store } from "lucide-react";
import { DetailShell } from "@/components/details/detail-shell";

export default function StoreNotFound() {
  return <DetailShell><section className="empty-state">
    <Store size={36} aria-hidden="true" />
    <h1>Tienda no disponible</h1>
    <p>Este comercio no está disponible o el enlace no existe.</p>
    <Link className="primary-button" href="/">Explorar otros productos</Link>
  </section></DetailShell>;
}

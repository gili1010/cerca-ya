"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { DatabaseRequestStatus } from "@/types/database";
import { requestUrgencies, type BuyerRequest } from "@/lib/buyer-requests";
import { isCoordinates } from "@/lib/location";

export function useRequestClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const tick = () => setNow(Date.now()); const timer = setInterval(tick, 1000); window.addEventListener("focus", tick); return () => { clearInterval(timer); window.removeEventListener("focus", tick); }; }, []);
  return now;
}
const labels: Record<DatabaseRequestStatus, string> = { OPEN: "Abierto", CLOSED: "Cerrado", CANCELLED: "Cancelado", EXPIRED: "Expirado" };
export function BuyerRequestBadge({ status }: { status: DatabaseRequestStatus }) {
  return <span className={`request-status ${status === "OPEN" ? "open" : "closed"}`}><i />{labels[status]}</span>;
}
export function BuyerRequestFacts({ request }: { request: BuyerRequest }) {
  return <dl className="request-facts"><div><dt>Categoría</dt><dd>{request.category?.name ?? "Categoría no disponible"}</dd></div><div><dt>Urgencia</dt><dd>{requestUrgencies[request.needed_when]}</dd></div><div><dt>Ubicación</dt><dd>{isCoordinates(request) ? "📍 Ubicación compartida" : "Sin ubicación compartida"}</dd></div><div><dt>Radio solicitado</dt><dd>Hasta {request.radius_km} km</dd></div><div><dt>Creado</dt><dd><time dateTime={request.created_at}>{new Date(request.created_at).toLocaleString("es-AR")}</time></dd></div><div><dt>Vencimiento</dt><dd><time dateTime={request.expires_at}>{new Date(request.expires_at).toLocaleString("es-AR")}</time></dd></div></dl>;
}
export function UnavailableBuyerRequest() {
  return <section className="empty-state"><h1>Este pedido no está disponible.</h1><Link className="primary-button" href="/pedidos">Ir a Mis pedidos</Link></section>;
}

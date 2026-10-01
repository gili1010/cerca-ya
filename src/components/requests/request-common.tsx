"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, MapPin, Tag, Zap } from "lucide-react";
import type { Request } from "@/types/requests";

export function RequestStatusBadge({ request }: { request: Request }) {
  const label = request.status === "CANCELLED" ? "Cancelado" : request.status === "CLOSED" ? "Cerrado" : request.offersCount > 0 ? "Ofertas recibidas" : "Buscando ofertas";
  return <span className={`request-status ${request.status === "OPEN" ? request.offersCount > 0 ? "has-offers" : "open" : "closed"}`}><i />{label}</span>;
}

export function RelativeDate({ date }: { date: string }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  const label = minutes < 1 ? "Publicado recién" : minutes < 60 ? `Publicado hace ${minutes} min` : minutes < 1440 ? `Publicado hace ${Math.floor(minutes / 60)} h` : `Publicado el ${new Date(date).toLocaleDateString("es-AR")}`;
  return <time dateTime={date} title={new Date(date).toLocaleString("es-AR")}>{label}</time>;
}

export function RequestFacts({ request }: { request: Request }) {
  return <dl className="request-facts"><div><dt><Tag size={15} />Categoría</dt><dd>{request.category}</dd></div><div><dt><Zap size={15} />Urgencia</dt><dd>{request.neededWhen}</dd></div><div><dt><MapPin size={15} />Radio</dt><dd>Hasta {request.radiusKm} km</dd></div><div><dt><CalendarDays size={15} />Fecha</dt><dd>{new Date(request.createdAt).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</dd></div></dl>;
}

export function LoadingRequests() { return <p className="workflow-loading" role="status">Cargando pedidos de este navegador…</p>; }
export function MissingRequest({ offer = false }: { offer?: boolean }) { return <section className="empty-state"><h1>{offer ? "No encontramos esta oferta" : "No encontramos este pedido"}</h1><p>Puede que este enlace pertenezca a otro navegador o que los datos locales se hayan eliminado.</p><Link className="primary-button" href="/pedidos">Ir a Mis pedidos</Link></section>; }
export function FormError({ message }: { message: string }) { return message ? <p className="form-error" role="alert">{message}</p> : null; }

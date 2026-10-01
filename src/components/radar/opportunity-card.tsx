import Link from "next/link";
import { CircleCheck, Lightbulb, MapPin, Radio, Zap } from "lucide-react";
import { money } from "@/lib/products";
import { requestUrgencies } from "@/lib/buyer-requests";
import type { RealOpportunity } from "@/lib/real-radar";
import { RelativeDate } from "../requests/request-common";
import { formatDistance } from "@/lib/distance";

export function OpportunityCard({ opportunity }: { opportunity: RealOpportunity }) {
  const { request, categoryMatch, product } = opportunity;
  const formUrl = `/comercio/oportunidades/${request.id}/responder`;
  return <article className={`panel request-card radar-card ${!request.my_offer_id && request.offers_count === 0 ? "radar-highlight" : ""}`}>
    <div className="card-topline"><span>{request.my_offer_id ? <CircleCheck size={16} aria-hidden="true" /> : <Radio size={16} aria-hidden="true" />}{request.my_offer_id ? "Ya enviaste una oferta" : "Pedido abierto"}</span><span>Radio solicitado: {request.radius_km} km</span></div>
    <p className="radar-distance"><MapPin size={16} aria-hidden="true" />{request.distance_km === null ? "Distancia no disponible" : `A ${formatDistance(request.distance_km)}`}</p>
    <small>Busca:</small><h2>{request.title}</h2><RelativeDate date={request.created_at} /><p className="request-description">{request.description}</p>
    <div className="request-card-meta"><span>{request.category_name}</span>{categoryMatch && <span>Coincide con tus categorías</span>}<strong>{request.needed_when === "TODAY" && <Zap size={15} aria-hidden="true" />}{request.needed_when === "TODAY" ? "Lo necesita hoy" : requestUrgencies[request.needed_when]}</strong></div>
    <p className="radar-offer-count">{request.offers_count === 0 ? "Todavía sin ofertas" : `${request.offers_count} ${request.offers_count === 1 ? "oferta recibida" : "ofertas recibidas"}`}</p>
    {product && <div className="radar-suggestion"><p><Lightbulb size={17} />Tenés un producto que podría servir</p><small>Producto de tu catálogo</small><h3>{product.name}</h3><div><strong>{money(product.price)}</strong><span>Stock: {product.stock_quantity}</span></div><small>Coincidencia por palabras y categoría; revisá compatibilidad antes de ofrecer.</small></div>}
    {request.my_offer_id ? <Link className="outline-button" href={`/comercio/oferta-enviada/${request.my_offer_id}`}>Ver mi oferta</Link> : product ? <><Link className="primary-button" href={`${formUrl}?producto=${product.id}`}>Enviar esta oferta</Link><Link className="secondary-link" href={formUrl}>Ofrecer otro producto o alternativa</Link></> : <Link className="primary-button" href={formUrl}>Tengo este producto</Link>}
  </article>;
}

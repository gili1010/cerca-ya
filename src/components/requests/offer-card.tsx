import Link from "next/link";
import { ArrowRight, MapPin, Store, Truck } from "lucide-react";
import type { Offer } from "@/types/requests";
import { distance, money } from "@/lib/products";

export function OfferCard({ offer }: { offer: Offer }) {
  return <article className="panel offer-card"><div className="card-topline"><span><Store size={15} />{offer.businessName}</span>{offer.alternative && <span className="alternative-badge">Alternativa</span>}</div><h3>{offer.productName}</h3><strong className="offer-price">{money(offer.price)}</strong><p className="offer-distance"><MapPin size={14} />{distance(offer.distanceKm)} · <span>{offer.stockAvailable ? "Disponible" : "Sin stock"}</span></p><div className="offer-methods">{offer.pickupAvailable && <span><Store size={15} />Retiro inmediato</span>}{offer.deliveryAvailable && <span><Truck size={15} />{offer.estimatedDelivery}</span>}</div><Link className="offer-link" href={`/demo/pedido/${offer.requestId}/oferta/${offer.id}`}>Ver oferta <ArrowRight size={16} /></Link></article>;
}


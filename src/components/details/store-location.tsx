import { MapPin, Store } from "lucide-react";
import { type LocalStore } from "@/lib/stores";

export function StoreLocation({ store }: { store: LocalStore }) {
  return <section className="store-location" id="ubicacion" aria-labelledby="location-title">
    <div className="location-illustration" role="img" aria-label="Esquema ilustrativo del barrio. No representa una ubicación real."><div className="location-street street-one" /><div className="location-street street-two" /><div className="location-street street-three" /><div className="location-marker"><Store size={25} /><span>{store.name}</span></div><span className="location-caption">MAPA ILUSTRATIVO · SIN UBICACIÓN REAL</span></div>
    <div className="location-copy"><h2 id="location-title">Un comercio cerca tuyo</h2><p><MapPin size={17} /><strong>{store.address}</strong></p><p>{store.neighborhood}, Buenos Aires · Dirección ficticia</p><details><summary>Ver horarios de ejemplo</summary><dl className="store-hours">{store.hours.map(row => <div key={row.days}><dt>{row.days}</dt><dd>{row.time}</dd></div>)}</dl></details><small>Estos datos no indican que el comercio esté abierto ahora. No uses esta dirección para una visita real.</small></div>
  </section>;
}

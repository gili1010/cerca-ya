import { Check, MapPin, Store, Zap } from "lucide-react";

export function NeighborhoodMap() {
  return <div className="neighborhood-map" aria-label="Ilustración de comercios cercanos; mapa de ejemplo">
    <div className="map-label"><span className="live-dot" /> UN BARRIO LLENO DE SOLUCIONES</div>
    <svg className="map-streets" viewBox="0 0 500 360" fill="none" aria-hidden="true">
      <path d="M-30 95L510 260M35-40L315 390M265-20L85 390M495-10L290 390M-20 260L540 60" stroke="#e4ebdd" strokeWidth="55" />
      <path d="M-30 95L510 260M35-40L315 390M265-20L85 390M495-10L290 390M-20 260L540 60" stroke="#f9fbf4" strokeWidth="40" />
      <path d="M125 125L235 161L285 244" stroke="#76a260" strokeWidth="3" strokeDasharray="5 6" />
      <circle cx="250" cy="185" r="108" stroke="#78a265" strokeOpacity=".25" />
      <circle cx="250" cy="185" r="72" stroke="#78a265" strokeOpacity=".25" />
    </svg>
    <span className="map-shop map-shop-one"><Store size={20} /><i><Check size={9} /></i></span>
    <span className="map-shop map-shop-two"><Store size={20} /><i><Check size={9} /></i></span>
    <span className="map-shop map-shop-three"><Store size={17} /></span>
    <span className="map-you"><MapPin size={23} fill="currentColor" /><span>Tu barrio</span></span>
    <div className="map-stock"><span className="stock-check"><Check size={15} /></span><div><strong>Hay stock. Está cerca.</strong><span>Tu próxima solución, a unos pasos.</span></div></div>
    <div className="map-today"><Zap size={13} fill="currentColor" /> Lo encontrás. Lo tenés hoy.</div>
    <span className="map-demo">Ilustración · sin ubicación real</span>
  </div>;
}

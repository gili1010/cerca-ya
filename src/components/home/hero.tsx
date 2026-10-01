import { type RefObject } from "react";
import { ArrowRight, Camera, CheckCheck, Plus, Search, X, Zap } from "lucide-react";
import { NeighborhoodMap } from "./neighborhood-map";

interface HeroProps {
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onQuery: (value: string) => void;
  onSearch: () => void;
  onRequest: () => void;
  onUrgent: () => void;
  urgent: boolean;
}

export function Hero({ query, inputRef, onQuery, onSearch, onRequest, onUrgent, urgent }: HeroProps) {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-main">
      <span className="eyebrow"><span className="live-dot" /> CERCA TUYO. LISTO PARA HOY.</span>
      <h1 id="hero-title">¿Qué necesitás <span>hoy?</span></h1>
      <p className="hero-slogan">Encontralo cerca. Tenelo hoy.</p>
      <p className="hero-description">Productos en tu barrio, con stock confirmado.<br />Menos esperar. Más resolver.</p>
      <form className="hero-search" onSubmit={event => { event.preventDefault(); onSearch(); }}>
        <Search size={23} />
        <input ref={inputRef} value={query} onChange={event => onQuery(event.target.value)} placeholder="Buscar productos o tiendas cerca tuyo..." aria-label="Buscar productos o tiendas cerca tuyo" />
        {query && <button type="button" className="clear-query" onClick={() => onQuery("")} aria-label="Borrar búsqueda"><X size={17} /></button>}
        <button className="search-arrow" type="submit" aria-label="Buscar productos o tiendas"><ArrowRight size={22} /></button>
      </form>
      <div className="search-shortcuts" aria-label="Formas de buscar">
        <button className="shortcut-active" onClick={onSearch}><Search size={15} />Buscar</button>
        <button disabled title="Disponible próximamente"><Camera size={15} /><span>Buscar con foto</span><small>Próximamente</small></button>
        <button onClick={onRequest}><Plus size={16} /><span>Publicar lo que necesito</span></button>
      </div>
      <div className="urgent-row"><button className={`urgent-button ${urgent ? "is-active" : ""}`} aria-pressed={urgent} onClick={onUrgent}><Zap size={18} fill="currentColor" />Lo necesito hoy<ArrowRight size={16} /></button><span><CheckCheck size={16} />Cerca, disponible y confirmado.</span></div>
    </div>
    <NeighborhoodMap />
  </section>;
}

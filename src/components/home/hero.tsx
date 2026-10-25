import { type RefObject } from "react";
import { ArrowRight, Search, X, Zap, MapPin, CheckCircle, MessageSquare } from "lucide-react";
import { HomeLocality } from "./home-locality";
import styles from "./home-discovery.module.css";

interface HeroProps {
  compact?: boolean;
  query: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onQuery: (value: string) => void;
  onSearch: () => void;
  onUrgent: () => void;
  urgent: boolean;
  locality: string | null;
  province: string | null;
  hasCoordinates: boolean;
  onLocation: () => void;
  onLocality: (locality: string, province: string) => void;
}

export function Hero({ compact = false, query, inputRef, onQuery, onSearch, onUrgent, urgent, locality, province, hasCoordinates, onLocation, onLocality }: HeroProps) {
  return <section className={`${styles.hero} ${compact ? styles.compactHero : ""}`} aria-labelledby="hero-title">
    <div className={styles.heroContent}>
      {!compact && <span className="eyebrow">TU LOCALIDAD. MUCHAS POSIBILIDADES.</span>}
      <h1 id="hero-title">{compact ? "Encontrá lo que buscás." : <>Lo que necesitás,<br/><span>más cerca.</span></>}</h1>
      <p className={styles.lead}>{compact ? "Buscá y elegí el tipo de resultados que necesitás." : "Encontrá productos, artículos y servicios en tu zona."}</p>
      <form className={styles.search} role="search" onSubmit={event => { event.preventDefault(); onSearch(); }}>
        <Search size={22} aria-hidden="true"/>
        <input ref={inputRef} value={query} onChange={event => onQuery(event.target.value)} placeholder="¿Qué estás buscando?" aria-label="Buscar productos, artículos y servicios"/>
        {query && <button type="button" className={styles.clear} onClick={() => onQuery("")} aria-label="Borrar búsqueda"><X size={18} aria-hidden="true"/></button>}
        <button className={styles.submit} type="submit" aria-label="Buscar"><span>Buscar</span><ArrowRight size={20} aria-hidden="true"/></button>
      </form>
      {!compact && <><HomeLocality locality={locality} provinceCode={province} hasCoordinates={hasCoordinates} onLocation={onLocation} onLocality={onLocality}/>
      <div className={styles.today}><button type="button" aria-pressed={urgent} onClick={onUrgent}><Zap size={16} aria-hidden="true"/>Disponible hoy<ArrowRight size={15} aria-hidden="true"/></button><span>Explorá productos de comercios con los filtros de hoy y stock confirmado.</span></div></>}
    </div>
    {!compact && <aside className={styles.heroAside} aria-label="Qué podés encontrar en CercaYa">
      <span className={styles.asideLabel}>ENCONTRALO CERCA. TENELO HOY.</span>
      <h2>Primero tu zona.<br/>Después tus opciones.</h2>
      <ul><li><MapPin aria-hidden="true"/><span><strong>Elegí dónde buscar</strong><small>Cada sección te muestra su zona de búsqueda.</small></span></li><li><CheckCircle aria-hidden="true"/><span><strong>Revisá antes de decidir</strong><small>Consultá los datos publicados y las condiciones.</small></span></li><li><MessageSquare aria-hidden="true"/><span><strong>Si no está, pedilo</strong><small>Publicá una necesidad de producto o servicio.</small></span></li></ul>
      <p>Encontrá opciones locales y coordiná con quien las ofrece.</p>
    </aside>}
  </section>;
}


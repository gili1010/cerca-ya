import { ArrowUpRight, CheckCheck, MapPin, Store, Zap } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";

export function Footer({ onHow }: { onHow: () => void }) {
  return <><section className="local-promise"><div className="promise-icon"><Store size={31} /><span><CheckCheck size={16} /></span></div><div><span className="eyebrow">TU BARRIO TIENE LA RESPUESTA</span><h2>No está lejos. Está por acá.</h2><p>Conectamos lo que necesitás con los comercios que lo tienen.</p></div><button onClick={onHow}>Así funciona CercaYa <ArrowUpRight size={17} /></button></section>
    <div className="trust-row"><span><MapPin size={18} />Comercios cerca tuyo</span><span><CheckCheck size={18} />Stock con última confirmación</span><span><Zap size={18} />Disponibilidad para hoy</span></div>
    <footer className="site-footer"><Brand /><span>Encontralo cerca. Tenelo hoy.</span><Link className="secondary-link" href="/privacidad">Política de Privacidad</Link><small>Una forma más local de encontrar.</small></footer>
  </>;
}

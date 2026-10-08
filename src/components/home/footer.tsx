import { ArrowUpRight, CheckCheck, Mail, MapPin, Store, Zap } from "lucide-react";
import Link from "next/link";
import { Brand } from "./brand";
import { InstallCercaYa } from "../pwa/install-cercaya";
import styles from "./footer.module.css";

export function Footer({ onHow }: { onHow: () => void }) {
  return <><section className="local-promise"><div className="promise-icon"><Store size={31} /><span><CheckCheck size={16} /></span></div><div><span className="eyebrow">TU BARRIO TIENE LA RESPUESTA</span><h2>No está lejos. Está por acá.</h2><p>Conectamos lo que necesitás con los comercios que lo tienen.</p></div><button onClick={onHow}>Así funciona CercaYa <ArrowUpRight size={17} /></button></section>
    <div className="trust-row"><span><MapPin size={18} />Comercios cerca tuyo</span><span><CheckCheck size={18} />Stock con última confirmación</span><span><Zap size={18} />Disponibilidad para hoy</span></div>
    <footer className={styles.footer}>
      <div className={styles.identity}><Brand /><span>Encontralo cerca. Tenelo hoy.</span></div>
      <nav className={styles.links} aria-label="Información de CercaYa">
        <Link className={styles.link} href="/terminos"><span>Términos y Condiciones</span></Link>
        <Link className={styles.link} href="/privacidad"><span>Privacidad</span></Link>
        <Link className={styles.link} href="/reglas-comercios"><span>Reglas para Comercios</span></Link>
        <Link className={styles.link} href="/contacto"><Mail size={15} aria-hidden="true" /><span>Contacto</span></Link>
      </nav>
      <div className={styles.installAction}><InstallCercaYa /></div>
      <div className={styles.bottom}><small>© 2026 CercaYa</small><small>Una forma más local de encontrar.</small></div>
    </footer>
  </>;
}

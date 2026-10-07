import { Check, Coffee, Hammer, MapPin, Pill, ShoppingBasket } from "lucide-react";
import styles from "./neighborhood-map.module.css";

function Building({ x, y, color, roof }: { x: number; y: number; color: string; roof: string }) {
  return <g className={styles.building} transform={`translate(${x} ${y})`}>
    <ellipse cx="12" cy="79" rx="64" ry="17" fill="#244932" opacity=".13" />
    <path d="M-44 0L18 31V81L-44 50Z" fill={color} />
    <path d="M18 31L62 8V58L18 81Z" fill={color} />
    <path d="M18 31L62 8V58L18 81Z" fill="#244932" opacity=".17" />
    <path d="M-44 0L0-23L62 8L18 31Z" fill={roof} />
    <path d="M-44 0L18 31L62 8V14L18 37L-44 6Z" fill="#244932" opacity=".16" />
    <path d="M-44 0L0-23L62 8" stroke="#ffffff" strokeOpacity=".45" strokeWidth="1.5" />
    <path d="M-48 16L18 49L18 59L-48 26Z" fill="#faf8ef" />
    <path d="M-40 20L-29 26V36L-40 30ZM-18 31L-7 37V47L-18 41ZM4 42L15 48V58L4 52Z" fill={roof} />
    <path d="M-31 35L-13 44V64L-31 55Z" fill="#315e4b" />
    <path d="M-5 49L8 55V76L-5 70Z" fill="#faf8ef" />
    <path d="M31 40L47 32V48L31 56Z" fill="#668a78" />
    <path d="M32 41L46 34" stroke="#edf5ed" strokeOpacity=".55" strokeWidth="1.5" />
    <path d="M18 38V79" stroke="#244932" strokeOpacity=".16" strokeWidth="1.5" />
    <path d="M-38 3L15 30" stroke="#ffffff" strokeOpacity=".35" strokeWidth="3" />
  </g>;
}

function Tree({ x, y }: { x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`}><ellipse cy="15" rx="15" ry="6" fill="#234d39" opacity=".08" /><path d="M0 0V16" stroke="#799173" strokeWidth="5" /><ellipse cy="-6" rx="16" ry="21" fill="#83ac7a" /><ellipse cx="-4" cy="-11" rx="10" ry="14" fill="#a4c392" /></g>;
}

export function NeighborhoodMap() {
  return <div className={`neighborhood-map ${styles.scene}`} role="img" aria-label="Ilustración de un barrio con comercios y un pin central. Los lugares, tiempos y estados son ejemplos, sin ubicación real.">
    <div className={styles.artwork} aria-hidden="true">
      <div className={styles.heading}><span className="live-dot" />UN BARRIO LLENO DE SOLUCIONES</div>
      <svg className={styles.city} viewBox="0 0 640 480" fill="none">
        <ellipse cx="320" cy="315" rx="265" ry="122" fill="#cdddc9" opacity=".35" />
        <path d="M30 265L312 112L610 264L330 417Z" fill="#dbe7d4" />
        <path d="M30 265V277L330 429V417ZM330 417V429L610 276V264Z" fill="#b9cdb0" />
        <path d="M-4 245L336 418M125 172L464 347M254 103L605 280M96 325L412 153M229 395L549 221" stroke="#cbd7c5" strokeWidth="35" />
        <path d="M-4 245L336 418M125 172L464 347M254 103L605 280M96 325L412 153M229 395L549 221" stroke="#fbfcf7" strokeWidth="25" />
        <path d="M170 228L305 299L434 228" stroke="#739c68" strokeWidth="3" strokeDasharray="6 8" strokeLinecap="round" />
        <ellipse cx="311" cy="291" rx="94" ry="48" stroke="#5e8c57" strokeOpacity=".2" />
        <ellipse cx="311" cy="291" rx="60" ry="30" stroke="#5e8c57" strokeOpacity=".25" />
        <Building x={194} y={173} color="#ead4af" roof="#be9463" />
        <Building x={388} y={176} color="#c9dac7" roof="#6a977c" />
        <Building x={143} y={286} color="#d6dee5" roof="#6e8a9b" />
        <Building x={437} y={292} color="#e4cab7" roof="#b97b60" />
        <Tree x={275} y={164} /><Tree x={477} y={248} /><Tree x={80} y={255} /><Tree x={289} y={366} /><Tree x={362} y={355} />
        <path d="M237 342L257 331L279 342L259 353Z" fill="#f4e2a4" /><path d="M237 342V350L259 361L279 350V342L259 353Z" fill="#d0b76f" />
      </svg>
      <div className={`${styles.place} ${styles.cafe}`}><span className={styles.placeIcon}><Coffee size={19} /></span><div><strong>Cafetería</strong><small><i />Abierto · 3 min</small></div></div>
      <div className={`${styles.place} ${styles.pharmacy}`}><span className={styles.placeIcon}><Pill size={19} /></span><div><strong>Farmacia</strong><small><Check size={11} />Hay stock</small></div></div>
      <div className={`${styles.place} ${styles.hardware}`}><span className={styles.placeIcon}><Hammer size={19} /></span><div><strong>Ferretería</strong><small><Check size={11} />Disponible hoy</small></div></div>
      <div className={`${styles.place} ${styles.market}`}><span className={styles.placeIcon}><ShoppingBasket size={19} /></span><div><strong>Supermercado</strong><small><i />A unos pasos</small></div></div>
      <div className={styles.location}><span><MapPin size={29} fill="currentColor" /></span><strong>Tu barrio</strong></div>
      <div className={styles.stock}><span className={styles.stockIcon}><Check size={21} /></span><div><strong>Hay stock. Está cerca.</strong><p>Tu próxima solución, a unos pasos.</p></div></div>
      <span className={styles.caption}>Ilustración · sin ubicación real</span>
    </div>
  </div>;
}

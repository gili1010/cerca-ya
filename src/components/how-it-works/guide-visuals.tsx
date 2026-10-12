import { ArrowDown, Check, MapPin, MessageCircle, Search, Store, UserRound } from "lucide-react";
import styles from "./guide.module.css";

export function NeighborhoodConnectionVisual() {
  return <figure className={styles.connectionVisual}>
    <div className={styles.neighborhoodScene} aria-hidden="true">
      <svg className={styles.connectionPath} viewBox="0 0 400 280" fill="none" preserveAspectRatio="none">
        <path d="M-20 220H120Q200 220 200 140V100Q200 60 280 60H420" stroke="white" strokeWidth="28" />
        <path d="M-20 220H120Q200 220 200 140V100Q200 60 280 60H420" stroke="var(--line-strong)" strokeWidth="2" strokeDasharray="5 7" />
      </svg>
      <div className={styles.customerStation}>
        <span className={styles.personIcon}><UserRound size={24} /></span>
        <div><strong>Vos</strong><span>Buscás o publicás</span></div>
        <Search size={18} />
      </div>
      <span className={styles.centerPin}><MapPin size={27} /></span>
      <div className={styles.businessStation}>
        <span className={styles.storeAwning} />
        <div><span className={styles.shopIcon}><Store size={24} /></span><div><strong>Comercio local</strong><span>Muestra y responde</span></div></div>
        <span className={styles.localTag}><Check size={13} />En tu barrio</span>
      </div>
      <span className={styles.sceneLabel}>CercaYa conecta</span>
    </div>
    <figcaption>Una necesidad. Opciones en tu barrio.</figcaption>
  </figure>;
}

export function OpenRequestVisual() {
  return <figure className={styles.requestVisual}>
    <div aria-hidden="true">
      <div className={styles.requestPaper}><span>VOS PUBLICÁS</span><strong>Lo que necesitás</strong><div className={styles.paperLines}><i /><i /></div><span className={styles.requestTag}><Search size={15} />Pedido Abierto</span></div>
      <span className={styles.requestConnector}><ArrowDown size={22} /></span>
      <div className={styles.responsePaper}><span className={styles.responseIcon}><MessageCircle size={21} /></span><div><strong>Ofertas de comercios</strong><span>Revisás y elegís</span></div></div>
    </div>
    <figcaption>Vos contás la necesidad. Los comercios pueden responder.</figcaption>
  </figure>;
}

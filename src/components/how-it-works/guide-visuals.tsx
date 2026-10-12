import { ArrowRight, Check, MapPin, MessageCircle, PackageCheck, Radio, Search, Store, UserRound, Wrench } from "lucide-react";
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
    <span className={styles.visualMeta}>Ejemplo ilustrativo</span>
    <ol className={styles.requestStages} aria-hidden="true">
      <li><span className={styles.visualStepNumber}>1</span><div className={styles.stageCard}><span className={styles.stageLabel}><Wrench size={18} />Pedido Abierto</span><strong>“Necesito un repuesto para mi moto”</strong><span>Vos publicás lo que buscás.</span></div></li>
      <li><span className={styles.visualStepNumber}>2</span><div className={styles.radarRoute}><Radio size={24} /><div><strong>Aparece en Radar</strong><span>Para comercios compatibles dentro de la zona elegida.</span></div></div></li>
      <li><span className={styles.visualStepNumber}>3</span><div className={`${styles.stageCard} ${styles.offerStage}`}><span className={styles.stageLabel}><MessageCircle size={18} />Una posible oferta</span><strong>Un comercio puede darte una opción</strong><span>Revisás el producto y cómo coordinar.</span></div></li>
      <li><span className={styles.visualStepNumber}>4</span><div className={styles.stageDecision}><Check size={24} /><div><strong>Vos decidís</strong><span>Elegís con quién hablar y coordinás.</span></div></div></li>
    </ol>
    <figcaption>Pedido de ejemplo → Radar → posible oferta → tu decisión.</figcaption>
  </figure>;
}

function ProductIllustration({ kind = "sandwich" }: { kind?: "sandwich" | "package" }) {
  return <svg className={styles.productDrawing} viewBox="0 0 160 120" fill="none" aria-hidden="true">
    <ellipse cx="80" cy="108" rx="61" ry="6" fill="#193d2910" />
    {kind === "sandwich" ? <>
      <path d="M18 51C18 12 142 12 142 51V57H18Z" fill="#ead9b5" stroke="#c6b087" strokeWidth="2" />
      <path d="M16 65Q30 54 44 65T72 65T100 65T128 65L144 63" stroke="var(--green)" strokeWidth="10" strokeLinecap="round" />
      <rect x="18" y="72" width="124" height="11" rx="5" fill="var(--deep)" />
      <path d="M18 83H142V90C142 105 18 105 18 90Z" fill="#ead9b5" stroke="#c6b087" strokeWidth="2" />
      <path d="M40 40L45 38M68 30L73 32M97 31L101 29M119 42L123 44" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </> : <>
      <path d="M30 37L80 17L130 37V88L80 109L30 88Z" fill="var(--surface-soft)" stroke="var(--line-strong)" strokeWidth="2" />
      <path d="M80 58L130 37V88L80 109Z" fill="#d7ed9c88" />
      <path d="M30 37L80 58L130 37M80 58V109M57 26L108 47V63" stroke="var(--green)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M43 73L63 81M43 81L56 86" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" />
    </>}
  </svg>;
}

export function LocalSearchVisual() {
  return <figure className={styles.interfaceVisual}>
    <div className={styles.miniScreen} aria-hidden="true">
      <div className={styles.visualMeta}><span><MapPin size={16} />En tu zona</span><span>Ejemplo ilustrativo</span></div>
      <strong className={styles.screenTitle}>Buscá un producto cerca tuyo</strong>
      <div className={styles.mockSearch}><span>Lomito completo</span><Search size={21} /></div>
      <div className={styles.miniProduct}><div className={styles.productThumb}><ProductIllustration /></div><div className={styles.productInfo}><strong>Lomito completo</strong><span>Comercio de ejemplo</span><span className={styles.previewStock}><PackageCheck size={16} />Disponible hoy</span></div></div>
      <div className={styles.mockActions}><span className={styles.mockPrimary}>Ver producto<ArrowRight size={17} /></span><span className={styles.mockSecondary}><MessageCircle size={17} />Consultar</span></div>
    </div>
    <figcaption>Ejemplo ilustrativo: buscás un lomito completo y ves un producto, un comercio y su disponibilidad informada.</figcaption>
  </figure>;
}

export function MerchantStoreVisual() {
  return <figure className={styles.interfaceVisual}>
    <div className={`${styles.miniScreen} ${styles.storePreview}`} aria-hidden="true">
      <div className={styles.previewCover}><Store size={20} /><span>Tu comercio en CercaYa</span><span>Ejemplo</span></div>
      <div className={styles.storePreviewBody}>
        <div className={styles.storePreviewIdentity}><span className={styles.shopIcon}><Store size={26} /></span><div><strong>Comercio de ejemplo</strong><span>Tu tienda pública</span></div></div>
        <div className={styles.miniProduct}><div className={styles.productThumb}><ProductIllustration kind="package" /></div><div className={styles.productInfo}><strong>Producto de ejemplo</strong><span>Disponibilidad informada</span></div></div>
        <span className={styles.storePreviewAction}>Ver tienda pública<ArrowRight size={17} /></span>
      </div>
      <div className={styles.radarPreview}><Radio size={26} /><div><strong>Una oportunidad en Radar</strong><p>Un cliente busca algo compatible con tu comercio, en tu zona.</p><span>Podés revisar el pedido y responder.</span></div></div>
    </div>
    <figcaption>Ejemplo ilustrativo: tu catálogo visible y oportunidades en Radar.</figcaption>
  </figure>;
}

import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Heart, MapPin, Search, Store } from "lucide-react";
import { BackLink } from "@/components/navigation/back-link";
import { accountBenefits, buyerSteps, connectionSteps, guideAnchors, guideFaqs, merchantSteps, trustCards, waysToBuy, type GuideCard } from "./guide-content";
import { LocalSearchVisual, MerchantStoreVisual, NeighborhoodConnectionVisual, OpenRequestVisual } from "./guide-visuals";
import styles from "./guide.module.css";

function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) {
  return <header className={styles.sectionHeading}><span className={styles.eyebrow}>{eyebrow}</span><h2 id={id}>{title}</h2><p>{description}</p></header>;
}

function StepCards({ steps, merchant = false }: { steps: GuideCard[]; merchant?: boolean }) {
  return <ol className={`${styles.stepGrid} ${merchant ? styles.merchantSteps : ""}`}>{steps.map(({ title, description, icon: Icon }, index) => <li key={title} className={styles.stepCard}>
    <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span>
    <div><h3><Icon size={22} aria-hidden="true" />{title}</h3><p>{description}</p></div>
  </li>)}</ol>;
}

export function HowItWorksGuide() {
  return <article className={styles.guide}>
    <BackLink href="/">Volver a CercaYa</BackLink>
    <header className={styles.hero}>
      <div className={styles.heroCopy}>
        <span className={styles.heroTag}><MapPin size={16} aria-hidden="true" />TU BARRIO, MÁS A MANO</span>
        <h1>Cómo funciona <span>CercaYa</span></h1>
        <p className={styles.slogan}>Encontralo cerca. Tenelo hoy.</p>
        <p className={styles.heroIntro}>Encontrá productos y comercios cerca tuyo. Reservá o consultá directamente. Si no encontrás lo que necesitás, publicalo para que los comercios puedan responderte.</p>
        <div className={styles.actions}><Link className="primary-button" href="/#catalogo">Explorar productos<ArrowRight size={18} aria-hidden="true" /></Link><Link className="outline-button" href="/pedido/nuevo">Publicar lo que necesito</Link></div>
        <p className={styles.heroNote}>Comercios locales. Contacto directo. Opciones para hoy.</p>
      </div>
      <NeighborhoodConnectionVisual />
    </header>

    <nav className={styles.index} aria-label="Secciones de la guía">
      <span>¿Por dónde empezamos?</span>
      <div>{guideAnchors.map(({ id, label }) => <a key={id} href={`#${id}`}>{label}<ArrowRight size={14} aria-hidden="true" /></a>)}</div>
    </nav>

    <section id="clientes" className={styles.section} aria-labelledby="guide-buyers-title">
      <SectionHeading id="guide-buyers-title" eyebrow="SOY CLIENTE" title="Encontrá. Elegí. Coordiná." description="Buscá lo que necesitás sin perder de vista a los comercios de tu zona." />
      <div className={styles.buyerLayout}><StepCards steps={buyerSteps} /><LocalSearchVisual /></div>
      <p className={styles.supportNote}><Heart size={18} aria-hidden="true" />También podés guardar los productos que te interesan para volver a verlos durante tu visita.</p>
    </section>

    <section id="pedido-abierto" className={`${styles.section} ${styles.openRequest}`} aria-labelledby="guide-open-title">
      <div>
        <span className={styles.eyebrow}>EL CATÁLOGO NO ES EL LÍMITE</span>
        <h2 id="guide-open-title">¿No aparece?<br />Contá qué necesitás.</h2>
        <p>Describí lo que buscás y elegí hasta qué distancia. Los comercios compatibles de esa zona pueden descubrir tu pedido en Radar y responder con una oferta.</p>
        <ul className={styles.checkList}><li><Check size={17} aria-hidden="true" />Las ofertas llegan a tu pedido, si un comercio responde.</li><li><Check size={17} aria-hidden="true" />Vos revisás las opciones y decidís con quién coordinar.</li></ul>
        <Link className="primary-button" href="/pedido/nuevo">Crear un Pedido Abierto<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <OpenRequestVisual />
    </section>

    <section id="comercios" className={`${styles.section} ${styles.merchantSection}`} aria-labelledby="guide-merchants-title">
      <SectionHeading id="guide-merchants-title" eyebrow="SOY COMERCIO" title="Tu tienda, más cerca de tus clientes." description="Un canal más para mostrar lo que vendés y recibir oportunidades de tu barrio." />
      <div className={styles.merchantLayout}><MerchantStoreVisual /><StepCards steps={merchantSteps} merchant /></div>
      <div className={styles.sectionAction}><Link className={`primary-button ${styles.merchantCta}`} href="/comercio/crear"><Store size={20} aria-hidden="true" />Crear mi comercio<ArrowRight size={18} aria-hidden="true" /></Link><span>Si ya tenés uno, <Link href="/comercio">entrá a tu panel<ArrowRight size={15} aria-hidden="true" /></Link>.</span></div>
    </section>

    <section className={`${styles.section} ${styles.connectionSection}`} aria-labelledby="guide-connect-title">
      <SectionHeading id="guide-connect-title" eyebrow="ASÍ NOS CONECTAMOS · UN EJEMPLO" title="Necesitás algo para hoy. Empezá por tu barrio." description="Una búsqueda cotidiana te ayuda a entender el recorrido, de principio a fin." />
      <ol className={styles.connectionSteps}>{connectionSteps.map(({ title, description }, index) => <li key={title}><span aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
      <p className={styles.everydayFallback}>¿No aparece lo que buscás? <a href="#pedido-abierto">Publicá un Pedido Abierto<ArrowRight size={16} aria-hidden="true" /></a></p>
    </section>

    <section id="reservas" className={styles.section} aria-labelledby="guide-reservations-title">
      <SectionHeading id="guide-reservations-title" eyebrow="ELEGÍ EL CAMINO QUE TE SIRVA" title="Reservar, consultar o pedir ofertas." description="Son tres maneras distintas de acercarte a lo que necesitás." />
      <div className={styles.threeColumns}>{waysToBuy.map(({ title, description, when, icon: Icon }) => <div className={styles.explainerCard} key={title}><span className={styles.iconWell}><Icon size={26} aria-hidden="true" /></span><span className={styles.choiceContext}>{when}</span><h3>{title}</h3><p>{description}</p></div>)}</div>
      <p className={styles.supportNote}>Hacer un pedido no realiza el pago. La entrega, el retiro y el pago se coordinan con el comercio según sus opciones.</p>
    </section>

    <section id="cuenta" className={styles.section} aria-labelledby="guide-account-title">
      <SectionHeading id="guide-account-title" eyebrow="CON TU CUENTA" title="Todo tu recorrido, en un lugar." description="Podés explorar sin registrarte. Tu cuenta te permite participar y seguir lo que pediste." />
      <div className={styles.benefits}>{accountBenefits.map(({ title, icon: Icon, items }) => <div className={styles.benefitCard} key={title}><span className={styles.iconWell}><Icon size={23} aria-hidden="true" /></span><h3>{title}</h3><ul className={styles.checkList}>{items.map(item => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul></div>)}</div>
      <div className={styles.sectionAction}><Link className="primary-button" href="/registro">Crear mi cuenta<ArrowRight size={18} aria-hidden="true" /></Link><span>¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>.</span></div>
    </section>

    <section className={styles.section} aria-labelledby="guide-trust-title">
      <SectionHeading id="guide-trust-title" eyebrow="INFORMACIÓN PARA ELEGIR" title="Cercanía también es claridad." description="Antes de coordinar, mirá los datos que comparte cada comercio." />
      <div className={styles.trustList}>{trustCards.map(({ title, description, icon: Icon }) => <div className={styles.trustCard} key={title}><Icon size={28} aria-hidden="true" /><div><h3>{title}</h3><p>{description}</p></div></div>)}</div>
    </section>

    <section id="preguntas" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="guide-faq-title">
      <SectionHeading id="guide-faq-title" eyebrow="ANTES DE EMPEZAR" title="Preguntas frecuentes" description="Las respuestas cortas a las dudas más comunes." />
      <div className={styles.faqList}>{guideFaqs.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
    </section>

    <section className={styles.finalCta} aria-labelledby="guide-start-title">
      <span className={styles.eyebrow}>AHORA TE TOCA A VOS</span>
      <h2 id="guide-start-title">Ahora que conocés CercaYa, elegí por dónde empezar.</h2>
      <div className={styles.finalChoices}>
        <Link className={styles.finalChoice} href="/#catalogo"><Search size={28} aria-hidden="true" /><span><strong>Quiero encontrar productos</strong><span>Explorar productos<ArrowRight size={18} aria-hidden="true" /></span></span></Link>
        <Link className={`${styles.finalChoice} ${styles.sellChoice}`} href="/comercio/crear"><Store size={28} aria-hidden="true" /><span><strong>Quiero vender en CercaYa</strong><span>Crear mi comercio<ArrowRight size={18} aria-hidden="true" /></span></span></Link>
      </div>
      <Link className={styles.finalRequest} href="/pedido/nuevo">¿No encontraste una opción? Publicá lo que necesitás<ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  </article>;
}

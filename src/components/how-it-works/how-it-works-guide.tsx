import Link from "next/link";
import { ArrowRight, Check, ChevronDown, Heart, MapPin, Store } from "lucide-react";
import { BackLink } from "@/components/navigation/back-link";
import { accountBenefits, buyerSteps, connectionSteps, guideAnchors, guideFaqs, merchantSteps, trustCards, waysToBuy, type GuideCard } from "./guide-content";
import { NeighborhoodConnectionVisual, OpenRequestVisual } from "./guide-visuals";
import styles from "./guide.module.css";

function SectionHeading({ id, eyebrow, title, description }: { id: string; eyebrow: string; title: string; description: string }) {
  return <header className={styles.sectionHeading}><span className={styles.eyebrow}>{eyebrow}</span><h2 id={id}>{title}</h2><p>{description}</p></header>;
}

function StepCards({ steps }: { steps: GuideCard[] }) {
  return <ol className={styles.stepGrid}>{steps.map(({ title, description, icon: Icon }, index) => <li key={title} className={styles.stepCard}>
    <div className={styles.stepTop}><span className={styles.iconWell}><Icon size={24} aria-hidden="true" /></span><span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span></div>
    <h3>{title}</h3><p>{description}</p>
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
      <StepCards steps={buyerSteps} />
      <p className={styles.supportNote}><Heart size={18} aria-hidden="true" />También podés guardar los productos que te interesan para volver a verlos durante tu visita.</p>
    </section>

    <section id="pedido-abierto" className={`${styles.section} ${styles.openRequest}`} aria-labelledby="guide-open-title">
      <div>
        <span className={styles.eyebrow}>EL CATÁLOGO NO ES EL LÍMITE</span>
        <h2 id="guide-open-title">¿No aparece?<br />Contá qué necesitás.</h2>
        <p>Un Pedido Abierto lleva tu búsqueda a los comercios. Describí lo que buscás, elegí la categoría y el radio, y revisá las ofertas que recibas.</p>
        <ul className={styles.checkList}><li><Check size={17} aria-hidden="true" />Los comercios pueden responder mientras esté abierto.</li><li><Check size={17} aria-hidden="true" />Vos revisás las opciones y decidís con quién coordinar.</li></ul>
        <Link className="primary-button" href="/pedido/nuevo">Crear un Pedido Abierto<ArrowRight size={18} aria-hidden="true" /></Link>
      </div>
      <OpenRequestVisual />
    </section>

    <section id="comercios" className={styles.section} aria-labelledby="guide-merchants-title">
      <SectionHeading id="guide-merchants-title" eyebrow="SOY COMERCIO" title="Tu tienda, más cerca de tus clientes." description="Un canal más para mostrar lo que vendés y recibir oportunidades de tu barrio." />
      <StepCards steps={merchantSteps} />
      <div className={styles.sectionAction}><Link className="outline-button" href="/comercio/crear"><Store size={18} aria-hidden="true" />Crear mi comercio</Link><span>Si ya tenés uno, <Link href="/comercio">entrá a tu panel<ArrowRight size={15} aria-hidden="true" /></Link>.</span></div>
    </section>

    <section className={`${styles.section} ${styles.connectionSection}`} aria-labelledby="guide-connect-title">
      <SectionHeading id="guide-connect-title" eyebrow="ASÍ NOS CONECTAMOS" title="De una necesidad a una opción local." description="CercaYa acerca la búsqueda del cliente a lo que los comercios tienen para ofrecer." />
      <ol className={styles.connectionSteps}>{connectionSteps.map(({ title, description }, index) => <li key={title}><span aria-hidden="true">{index + 1}</span><h3>{title}</h3><p>{description}</p></li>)}</ol>
    </section>

    <section id="reservas" className={styles.section} aria-labelledby="guide-reservations-title">
      <SectionHeading id="guide-reservations-title" eyebrow="ELEGÍ EL CAMINO QUE TE SIRVA" title="Reservar, consultar o pedir ofertas." description="Son tres maneras distintas de acercarte a lo que necesitás." />
      <div className={styles.threeColumns}>{waysToBuy.map(({ title, description, icon: Icon }) => <div className={styles.explainerCard} key={title}><span className={styles.iconWell}><Icon size={24} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></div>)}</div>
      <p className={styles.supportNote}>Hacer un pedido no realiza el pago. La entrega, el retiro y el pago se coordinan con el comercio según sus opciones.</p>
    </section>

    <section id="cuenta" className={styles.section} aria-labelledby="guide-account-title">
      <SectionHeading id="guide-account-title" eyebrow="CON TU CUENTA" title="Todo tu recorrido, en un lugar." description="Podés explorar sin registrarte. Tu cuenta te permite participar y seguir lo que pediste." />
      <div className={styles.benefits}>{accountBenefits.map(({ title, icon: Icon, items }) => <div className={styles.benefitCard} key={title}><span className={styles.iconWell}><Icon size={23} aria-hidden="true" /></span><h3>{title}</h3><ul className={styles.checkList}>{items.map(item => <li key={item}><Check size={17} aria-hidden="true" />{item}</li>)}</ul></div>)}</div>
      <div className={styles.sectionAction}><Link className="primary-button" href="/registro">Crear mi cuenta<ArrowRight size={18} aria-hidden="true" /></Link><span>¿Ya tenés cuenta? <Link href="/login">Iniciá sesión</Link>.</span></div>
    </section>

    <section className={styles.section} aria-labelledby="guide-trust-title">
      <SectionHeading id="guide-trust-title" eyebrow="INFORMACIÓN PARA ELEGIR" title="Cercanía también es claridad." description="Antes de coordinar, mirá los datos que comparte cada comercio." />
      <div className={styles.threeColumns}>{trustCards.map(({ title, description, icon: Icon }) => <div className={styles.trustCard} key={title}><Icon size={22} aria-hidden="true" /><h3>{title}</h3><p>{description}</p></div>)}</div>
    </section>

    <section id="preguntas" className={`${styles.section} ${styles.faqSection}`} aria-labelledby="guide-faq-title">
      <SectionHeading id="guide-faq-title" eyebrow="ANTES DE EMPEZAR" title="Preguntas frecuentes" description="Las respuestas cortas a las dudas más comunes." />
      <div className={styles.faqList}>{guideFaqs.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div>
    </section>

    <section className={styles.finalCta} aria-labelledby="guide-start-title">
      <span className={styles.eyebrow}>AHORA TE TOCA A VOS</span>
      <h2 id="guide-start-title">Tu barrio puede tener lo que buscás.</h2>
      <p>Explorá, publicá tu necesidad o acercá tu comercio a nuevos clientes.</p>
      <div className={styles.actions}><Link className={`primary-button ${styles.lightButton}`} href="/#catalogo">Explorar productos<ArrowRight size={18} aria-hidden="true" /></Link><Link className={`outline-button ${styles.darkOutline}`} href="/comercio/crear">Crear mi comercio</Link><Link className={`outline-button ${styles.darkOutline}`} href="/pedido/nuevo">Publicar lo que necesito</Link></div>
    </section>
  </article>;
}

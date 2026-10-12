import { BadgeCheck, ClipboardList, Clock3, Heart, MapPin, MessageCircle, PackageCheck, Radio, Search, ShoppingBag, Store, type LucideIcon } from "lucide-react";

export interface GuideCard {
  title: string;
  description: string;
  icon: LucideIcon;
  when?: string;
}

export const guideAnchors = [
  { id: "clientes", label: "Soy cliente" },
  { id: "comercios", label: "Soy comercio" },
  { id: "pedido-abierto", label: "Pedido Abierto" },
  { id: "reservas", label: "Reservas y contacto" },
  { id: "cuenta", label: "Beneficios" },
  { id: "preguntas", label: "Preguntas frecuentes" },
] as const;

export const buyerSteps: GuideCard[] = [
  { title: "Empezá por tu zona", description: "Elegí tu localidad o usá tu ubicación para encontrar productos y comercios cercanos.", icon: MapPin },
  { title: "Encontrá una opción", description: "Buscá por nombre o categoría. Con tu ubicación, también podés filtrar por distancia.", icon: Search },
  { title: "Reservá o consultá", description: "Pedí uno o varios productos del mismo comercio. Elegí retiro o envío según sus opciones.", icon: ShoppingBag },
  { title: "Seguí tu pedido", description: "En Mis reservas ves si está pendiente, confirmado, listo o completado. Aguardá la confirmación del comercio.", icon: PackageCheck },
];

export const merchantSteps: GuideCard[] = [
  { title: "Creá tu tienda", description: "Presentá tu comercio con nombre, ubicación, descripción, logo y portada.", icon: Store },
  { title: "Mostrá lo que vendés", description: "Publicá productos con fotos y precios. Mantené el stock o la disponibilidad de lo que preparás a pedido.", icon: ShoppingBag },
  { title: "Facilitá la compra", description: "Indicá horarios, retiro, envío y medios de pago. Sumá WhatsApp, Instagram y Facebook si los usás.", icon: Clock3 },
  { title: "Conectá con tu zona", description: "Gestioná pedidos y revisá en Radar lo que buscan clientes de tu zona. Compartí tu tienda por enlace o QR.", icon: Radio },
];

export const connectionSteps = [
  { title: "Buscás un lomito", description: "Escribís “lomito completo” y elegís tu zona." },
  { title: "Encontrás una opción", description: "Ves una lomitería y revisás su disponibilidad." },
  { title: "Reservás o consultás", description: "Pedís el producto o hablás por WhatsApp, si está disponible." },
  { title: "Coordinás con el comercio", description: "Acordás retiro o envío según sus opciones y confirmación." },
];

export const waysToBuy: GuideCard[] = [
  { title: "Reservar / hacer un pedido", when: "Ya encontraste el producto", description: "Elegís cantidad y modalidad, enviás el pedido y esperás la confirmación del comercio.", icon: PackageCheck },
  { title: "Consultar al comercio", when: "Tenés una duda", description: "Hablás directamente por WhatsApp cuando el comercio lo tiene disponible.", icon: MessageCircle },
  { title: "Publicar un Pedido Abierto", when: "Todavía lo estás buscando", description: "Contás qué necesitás y revisás las ofertas que los comercios puedan enviarte.", icon: ClipboardList },
];

export const trustCards: GuideCard[] = [
  { title: "Comercios verificados", description: "La insignia identifica comercios cuya existencia y responsable fueron confirmados por CercaYa.", icon: BadgeCheck },
  { title: "Disponibilidad informada", description: "Mirá la última confirmación de stock o disponibilidad. Puede cambiar: esperá que el comercio confirme tu pedido.", icon: PackageCheck },
  { title: "Horarios y contacto", description: "Consultá si está abierto según el horario informado y hablá con el comercio para coordinar tu visita.", icon: Clock3 },
];

export const accountBenefits = [
  { title: "Como cliente", icon: Heart, items: ["Tu historial y seguimiento de reservas.", "Tus Pedidos Abiertos y ofertas en un lugar."] },
  { title: "Como comercio", icon: Store, items: ["Tu tienda y catálogo accesibles para tus clientes.", "Pedidos, Radar y disponibilidad para gestionar."] },
];

export const guideFaqs = [
  { question: "¿Necesito cuenta para explorar?", answer: "No. Podés buscar productos y visitar tiendas públicas sin registrarte. Elegí tu zona para ver opciones cercanas." },
  { question: "¿Necesito cuenta para publicar un pedido?", answer: "Sí. Necesitás iniciar sesión para hacer un pedido o publicar un Pedido Abierto y consultar sus respuestas." },
  { question: "¿CercaYa cobra por comprar?", answer: "Durante esta etapa inicial, CercaYa no cobra comisión por las operaciones. Pagás directamente al comercio según lo acordado." },
  { question: "¿Los pagos se hacen dentro de la web?", answer: "No. CercaYa no procesa pagos. Elegís entre las opciones del comercio y coordinás el pago directamente con él." },
  { question: "¿Cómo contacto al comercio?", answer: "Desde el producto o su tienda, tocá Consultar al comercio si tiene WhatsApp. También podés revisar sus redes disponibles." },
  { question: "¿Qué pasa si no encuentro lo que busco?", answer: "Publicá un Pedido Abierto con lo que necesitás. Los comercios pueden enviarte ofertas; revisalas desde Mis pedidos." },
];

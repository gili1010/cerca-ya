import { BadgeCheck, ClipboardList, Clock3, Heart, MapPin, MessageCircle, PackageCheck, Radio, Search, ShoppingBag, Store, type LucideIcon } from "lucide-react";

export interface GuideCard {
  title: string;
  description: string;
  icon: LucideIcon;
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
  { title: "Conectá con tu zona", description: "Gestioná pedidos, respondé oportunidades desde Radar y compartí tu tienda con su enlace o QR.", icon: Radio },
];

export const connectionSteps = [
  { title: "Contás qué necesitás", description: "Buscás en el catálogo o publicás un Pedido Abierto." },
  { title: "Encontrás opciones cerca", description: "CercaYa reúne resultados y oportunidades de tu zona." },
  { title: "El comercio participa", description: "Publica sus productos o responde con una oferta." },
  { title: "Elegís y coordinás", description: "Reservás, consultás y acordás retiro o envío." },
];

export const waysToBuy: GuideCard[] = [
  { title: "Reservar / hacer un pedido", description: "Ya encontraste el producto. Elegís cantidad y modalidad, enviás el pedido y esperás la confirmación.", icon: PackageCheck },
  { title: "Consultar al comercio", description: "Tenés una duda. Usá WhatsApp cuando esté disponible para hablar directamente con el comercio.", icon: MessageCircle },
  { title: "Publicar un Pedido Abierto", description: "No encontraste una opción. Contás qué buscás y los comercios pueden enviarte ofertas para revisar.", icon: ClipboardList },
];

export const trustCards: GuideCard[] = [
  { title: "Comercios verificados", description: "La insignia identifica comercios cuya existencia y responsable fueron confirmados por CercaYa.", icon: BadgeCheck },
  { title: "Disponibilidad informada", description: "Mirá cuándo se confirmó el stock o la disponibilidad para elegir mejor. El comercio confirma tu pedido.", icon: PackageCheck },
  { title: "Horarios y contacto", description: "Consultá si está abierto según el horario informado y hablá con el comercio para coordinar tu visita.", icon: Clock3 },
];

export const accountBenefits = [
  { title: "Como cliente", icon: Heart, items: ["Consultar tu historial de pedidos y reservas.", "Publicar Pedidos Abiertos.", "Recibir y revisar ofertas de comercios."] },
  { title: "Como comercio", icon: Store, items: ["Crear tu tienda y publicar tu catálogo.", "Gestionar pedidos y disponibilidad.", "Responder oportunidades y completar tu perfil."] },
];

export const guideFaqs = [
  { question: "¿Necesito cuenta para explorar?", answer: "No. Podés buscar productos y visitar tiendas públicas sin registrarte. Elegí tu zona para ver opciones cercanas." },
  { question: "¿Necesito cuenta para publicar un pedido?", answer: "Sí. Necesitás iniciar sesión para hacer un pedido o publicar un Pedido Abierto y consultar sus respuestas." },
  { question: "¿CercaYa cobra por comprar?", answer: "Durante esta etapa inicial, CercaYa no cobra comisión por las operaciones. Pagás directamente al comercio según lo acordado." },
  { question: "¿Los pagos se hacen dentro de la web?", answer: "No. CercaYa no procesa pagos. Elegís entre las opciones del comercio y coordinás el pago directamente con él." },
  { question: "¿Cómo contacto al comercio?", answer: "Desde el producto o su tienda, tocá Consultar al comercio si tiene WhatsApp. También podés revisar sus redes disponibles." },
  { question: "¿Qué pasa si no encuentro lo que busco?", answer: "Publicá un Pedido Abierto con lo que necesitás. Los comercios pueden enviarte ofertas; revisalas desde Mis pedidos." },
];

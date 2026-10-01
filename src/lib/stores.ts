export type StoreId = "ferreteria-norte" | "punto-tech" | "casa-nativa" | "bazar-esquina" | "autopartes-del-parque" | "distrito-local" | "huellitas" | "botanica-del-barrio" | "audio-oeste";

export interface LocalStore {
  id: StoreId;
  name: string;
  category: string;
  description: string;
  address: string;
  neighborhood: string;
  distanceKm: number;
  hours: { days: string; time: string }[];
  deliveryArea: string | null;
  pickupInstructions: string;
}

// Fictional addresses and schedules. No real map or contact details.
const weekdayHours = [
  { days: "Lunes a viernes", time: "09:00 a 19:00" },
  { days: "Sábados", time: "09:00 a 13:00" },
  { days: "Domingos", time: "Cerrado" },
];

export const stores: LocalStore[] = [
  { id: "ferreteria-norte", name: "Ferretería Norte", category: "Ferretería", description: "Herramientas y soluciones para ese arreglo que no puede esperar. Un comercio de barrio para tus proyectos de todos los días.", address: "Av. del Barrio 1240", neighborhood: "Palermo", distanceKm: 1.8, hours: weekdayHours, deliveryArea: "Hasta 3 km del local", pickupInstructions: "Retiro por el mostrador principal." },
  { id: "punto-tech", name: "Punto Tech", category: "Tecnología", description: "Accesorios y tecnología para acompañarte todos los días, a unos pasos de casa.", address: "Pasaje Encuentro 320", neighborhood: "Palermo", distanceKm: 0.8, hours: weekdayHours, deliveryArea: "Hasta 4 km del local", pickupInstructions: "Retiro por el sector de atención al cliente." },
  { id: "casa-nativa", name: "Casa Nativa", category: "Hogar", description: "Objetos que hacen más tuyo tu espacio. Iluminación, muebles y detalles elegidos para tu hogar.", address: "Calle Los Vecinos 615", neighborhood: "Palermo", distanceKm: 0.6, hours: weekdayHours, deliveryArea: null, pickupInstructions: "Retiro en el local. Consultá medidas antes de trasladar muebles." },
  { id: "bazar-esquina", name: "Bazar Esquina", category: "Bazar", description: "Lo práctico y lo lindo para tu cocina, tu mesa y esos pequeños momentos de cada día.", address: "Av. del Barrio 880", neighborhood: "Palermo", distanceKm: 1.2, hours: weekdayHours, deliveryArea: "Hasta 2 km del local", pickupInstructions: "Retiro por el mostrador de la entrada." },
  { id: "autopartes-del-parque", name: "Autopartes del Parque", category: "Automotor", description: "Herramientas y accesorios para que puedas seguir en movimiento.", address: "Calle del Parque 1420", neighborhood: "Palermo", distanceKm: 2.4, hours: weekdayHours, deliveryArea: "Hasta 3 km del local", pickupInstructions: "Retiro por el sector de accesorios." },
  { id: "distrito-local", name: "Distrito Local", category: "Indumentaria", description: "Accesorios para salir, moverte y llevar tus planes a todas partes.", address: "Pasaje Encuentro 450", neighborhood: "Palermo", distanceKm: 0.9, hours: weekdayHours, deliveryArea: null, pickupInstructions: "Retiro en el local, por la entrada principal." },
  { id: "huellitas", name: "Huellitas Pet Shop", category: "Mascotas", description: "Un lugar cerca de casa para todo lo que necesita tu compañero de cuatro patas.", address: "Calle Los Vecinos 210", neighborhood: "Palermo", distanceKm: 0.4, hours: weekdayHours, deliveryArea: "Hasta 2 km del local", pickupInstructions: "Retiro por el mostrador. Las mascotas son bienvenidas." },
  { id: "botanica-del-barrio", name: "Botánica del Barrio", category: "Plantas y jardín", description: "Un poco más de verde para tu casa. Plantas y consejos para cuidarlas.", address: "Calle del Jardín 730", neighborhood: "Palermo", distanceKm: 1.6, hours: weekdayHours, deliveryArea: null, pickupInstructions: "Retiro en el vivero. Verificá disponibilidad antes de acercarte." },
  { id: "audio-oeste", name: "Audio Oeste", category: "Tecnología", description: "Sonido para llevar con vos. Parlantes y accesorios para disfrutar tu música.", address: "Av. del Encuentro 2200", neighborhood: "Villa Crespo", distanceKm: 5.7, hours: weekdayHours, deliveryArea: "Hasta 8 km del local", pickupInstructions: "Sin retiro disponible para los productos de esta demo." },
];

export const getStore = (id: string) => stores.find(store => store.id === id);

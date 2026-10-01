import type { BusinessRow, CategoryRow, ProductRow } from "@/types/database";

export const categoryNames = ["Ferretería", "Automotor", "Tecnología", "Hogar", "Indumentaria", "Mascotas", "Bazar", "Más"] as const;
export type Category = (typeof categoryNames)[number];
export type CategorySelection = Category | "Todas";
export type QuickFilter = "today" | "nearby" | "delivery" | "pickup" | "confirmed";
export type SortOrder = "recommended" | "distance" | "price";
export interface Product {
  id: string;
  name: string;
  category: string;
  store: string;
  storeId: string;
  price: number;
  distanceKm: number | null;
  image: string;
  description: string;
  stock: number;
  confirmedMinutesAgo: number | null;
  deliveryToday: boolean;
  deliveryPrice?: number;
  pickupToday: boolean;
  pickupMinutes: number | null;
  source?: "supabase";
  database?: {
    product: ProductRow;
    category: CategoryRow;
    business: Pick<BusinessRow, "id" | "name" | "city" | "address" | "latitude" | "longitude" | "whatsapp" | "pickup_enabled" | "delivery_enabled" | "delivery_price" | "active">;
  };
}

// Fictional catalog. Confirmation times use a fixed 15:00 demo snapshot.
export const products: Product[] = [
  { id: "taladro", name: "Taladro Bosch GSB 550", category: "Ferretería", store: "Ferretería Norte", storeId: "ferreteria-norte", price: 84900, distanceKm: 1.8, image: "photo-1504148455328-c376907d081c", description: "Taladro percutor de 550 W. Mandril de 13 mm. Foto ilustrativa de herramientas.", stock: 4, confirmedMinutesAgo: 40, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 15 },
  { id: "auriculares", name: "Auriculares inalámbricos", category: "Tecnología", store: "Punto Tech", storeId: "punto-tech", price: 42900, distanceKm: 0.8, image: "photo-1505740420928-5e560c06d30e", description: "Bluetooth, diseño de vincha y batería recargable. Foto ilustrativa.", stock: 6, confirmedMinutesAgo: 12, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 10 },
  { id: "lampara", name: "Lámpara de escritorio", category: "Hogar", store: "Casa Nativa", storeId: "casa-nativa", price: 32500, distanceKm: 0.6, image: "photo-1507473885765-e6ed057f782c", description: "Lámpara de mesa para darle un lugar a tus ideas. Foto ilustrativa.", stock: 2, confirmedMinutesAgo: 18, deliveryToday: false, pickupToday: true, pickupMinutes: 10 },
  { id: "tazas", name: "Set de tazas de cerámica", category: "Bazar", store: "Bazar Esquina", storeId: "bazar-esquina", price: 18900, distanceKm: 1.2, image: "photo-1514228742587-6b1558fcca3d", description: "Set de dos tazas de cerámica. Foto ilustrativa.", stock: 8, confirmedMinutesAgo: 25, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 20 },
  { id: "herramientas", name: "Kit de herramientas para auto", category: "Automotor", store: "Autopartes del Parque", storeId: "autopartes-del-parque", price: 56900, distanceKm: 2.4, image: "photo-1530124566582-a618bc2615dc", description: "Herramientas esenciales para llevar en el auto. Foto ilustrativa.", stock: 3, confirmedMinutesAgo: 35, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 15 },
  { id: "mochila", name: "Mochila urbana", category: "Indumentaria", store: "Distrito Local", storeId: "distrito-local", price: 38900, distanceKm: 0.9, image: "photo-1553062407-98eeb64c6a62", description: "Mochila resistente con compartimentos para todos los días. Foto ilustrativa.", stock: 5, confirmedMinutesAgo: 8, deliveryToday: false, pickupToday: true, pickupMinutes: 10 },
  { id: "mascotas", name: "Pelota para perros", category: "Mascotas", store: "Huellitas Pet Shop", storeId: "huellitas", price: 6900, distanceKm: 0.4, image: "photo-1537151625747-768eb6cf92b2", description: "Pelota de goma para jugar. Foto ilustrativa de mascota.", stock: 12, confirmedMinutesAgo: 15, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 5 },
  { id: "planta", name: "Planta de interior con maceta", category: "Más", store: "Botánica del Barrio", storeId: "botanica-del-barrio", price: 18500, distanceKm: 1.6, image: "photo-1501004318641-b39e6451bec6", description: "Un poco de verde para tu espacio. Incluye maceta de cultivo. Foto ilustrativa.", stock: 4, confirmedMinutesAgo: null, deliveryToday: false, pickupToday: true, pickupMinutes: 30 },
  { id: "parlante", name: "Parlante portátil Bluetooth", category: "Tecnología", store: "Audio Oeste", storeId: "audio-oeste", price: 64900, distanceKm: 5.7, image: "photo-1608043152269-423dbba4e7e1", description: "Parlante portátil recargable. Foto ilustrativa.", stock: 3, confirmedMinutesAgo: 55, deliveryToday: true, deliveryPrice: 2500, pickupToday: false, pickupMinutes: null },
  { id: "silla", name: "Silla de diseño", category: "Hogar", store: "Casa Nativa", storeId: "casa-nativa", price: 79000, distanceKm: 0.6, image: "photo-1503602642458-232111445657", description: "Silla de líneas simples. Disponible desde mañana. Foto ilustrativa.", stock: 2, confirmedMinutesAgo: 50, deliveryToday: false, pickupToday: false, pickupMinutes: null },
  // Published demo catalog used by Radar and the existing product screens alike.
  { id: "termica-schneider", name: "Térmica Schneider bipolar 25A", category: "Ferretería", store: "Ferretería Norte", storeId: "ferreteria-norte", price: 12500, distanceKm: 1.8, image: "photo-1504148455328-c376907d081c", description: "Interruptor termomagnético bipolar de 25 A. Verificá compatibilidad con tu instalación. Foto ilustrativa de herramientas.", stock: 3, confirmedMinutesAgo: 10, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 15 },
  { id: "mecha-pared", name: "Mecha para pared 8mm", category: "Ferretería", store: "Ferretería Norte", storeId: "ferreteria-norte", price: 3900, distanceKm: 1.8, image: "photo-1530124566582-a618bc2615dc", description: "Mecha para mampostería de 8 mm. Foto ilustrativa de herramientas.", stock: 8, confirmedMinutesAgo: 15, deliveryToday: false, pickupToday: true, pickupMinutes: 10 },
  { id: "cargador-samsung", name: "Cargador Samsung USB-C 25W", category: "Tecnología", store: "Punto Tech", storeId: "punto-tech", price: 21900, distanceKm: 0.8, image: "photo-1505740420928-5e560c06d30e", description: "Cargador USB-C de 25 W, cable no incluido. Foto ilustrativa de tecnología.", stock: 5, confirmedMinutesAgo: 12, deliveryToday: true, deliveryPrice: 2500, pickupToday: true, pickupMinutes: 10 },
];

export const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value);
export const photo = (id: string, width = 700) => id.startsWith("/") || /^https?:\/\//i.test(id) ? id : `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=85`;
export const distance = (km: number) => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("es-AR")} km`;
export function confirmationTime(minutes: number) {
  const total = 15 * 60 - minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

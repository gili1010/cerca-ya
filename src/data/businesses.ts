import type { Business, Request } from "@/types/requests";
import { stores } from "@/lib/stores";

// Fictional businesses; US 202-555-01xx numbers are reserved for fictional use.
export const businesses: Business[] = [
  { id: "comercio-demo", name: "Mi comercio de prueba", distanceKm: 3.2, whatsapp: "12025550100", businessCategories: ["Ferretería", "Tecnología"] },
  { id: "repuestos-centro", name: "Repuestos Centro", distanceKm: 4.2, whatsapp: "12025550101", businessCategories: ["Automotor"] },
  { id: "autopartes-sur", name: "Autopartes Sur", distanceKm: 8.1, whatsapp: "12025550102", businessCategories: ["Automotor"] },
  { id: "repuestos-lopez", name: "Repuestos López", distanceKm: 11, whatsapp: "12025550103", businessCategories: ["Automotor"] },
  ...stores.map((store, index): Business => ({
    id: store.id, name: store.name, distanceKm: store.distanceKm, whatsapp: `120255501${String(index + 4).padStart(2, "0")}`,
    catalogStoreId: store.id,
    businessCategories: store.id === "ferreteria-norte" ? ["Ferretería", "Electricidad", "Herramientas", "Pintura"] :
      store.id === "botanica-del-barrio" ? ["Otra", "Hogar"] : [store.category as Request["category"]],
  })),
];
export const DEMO_BUYER_ID = "comprador-demo";

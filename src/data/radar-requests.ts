import type { Request, RequestDatabase } from "@/types/requests";

const samples: Pick<Request, "title" | "description" | "category" | "neededWhen" | "approximateDistanceKm">[] = [
  { title: "Térmica bipolar 25A", description: "Busco una térmica bipolar para el tablero, preferentemente Schneider.", category: "Electricidad", neededWhen: "Lo necesito hoy", approximateDistanceKm: 2.1 },
  { title: "Taladro percutor 550W", description: "Necesito un taladro para perforar una pared.", category: "Ferretería", neededWhen: "Lo necesito hoy", approximateDistanceKm: 4.3 },
  { title: "Cargador Samsung USB-C 25W", description: "Busco un cargador compatible con carga rápida.", category: "Tecnología", neededWhen: "Mañana", approximateDistanceKm: 6.2 },
  { title: "Mecha para pared 8mm", description: "Necesito una mecha para mampostería de 8 mm.", category: "Ferretería", neededWhen: "Lo necesito hoy", approximateDistanceKm: 1.4 },
  { title: "Aceite Ford 5W30", description: "Busco aceite para un cambio programado esta semana.", category: "Automotor", neededWhen: "Esta semana", approximateDistanceKm: 8.5 },
  { title: "Zapatillas talle 42", description: "Busco zapatillas para caminar.", category: "Indumentaria", neededWhen: "No tengo apuro", approximateDistanceKm: 12.4 },
];

// Append once to the existing database, preserving IDs, offers and reservations.
export function seedRadarRequests(database: RequestDatabase, now: Date): RequestDatabase {
  if (database.radarSeedVersion === 1) return database;
  const nextId = database.requests.reduce((max, request) => Math.max(max, Number(request.id.slice(4))), 1000) + 1;
  const requests: Request[] = samples.map((sample, index) => ({
    ...sample, id: `PED-${nextId + index}`, buyerId: "comprador-demo", radiusKm: 20, status: "OPEN", offersCount: 0,
    createdAt: new Date(now.getTime() - (index + 1) * 3 * 60000).toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60000).toISOString(),
  }));
  return { ...database, requests: [...requests, ...database.requests], radarSeedVersion: 1 };
}

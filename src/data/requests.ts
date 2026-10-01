import type { Request } from "@/types/requests";

export function createMockRequests(now: Date): Request[] {
  return [
    { id: "PED-1001", buyerId: "comprador-demo", title: "Sensor de cigüeñal Ford Ka 2019", description: "Motor 1.5, necesito retirarlo hoy si es posible.", category: "Automotor", neededWhen: "Lo necesito hoy", radiusKm: 20, status: "OPEN", createdAt: new Date(now.getTime() - 12 * 60000).toISOString(), offersCount: 3 },
    { id: "PED-1002", buyerId: "comprador-demo", title: "Térmica bipolar 25A", description: "Busco una térmica para el tablero de casa.", category: "Ferretería", neededWhen: "Mañana", radiusKm: 10, status: "OPEN", createdAt: new Date(now.getTime() - 6 * 60000).toISOString(), offersCount: 0 },
  ];
}

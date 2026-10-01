"use client";

import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readReservations } from "@/lib/real-reservations";
import { useAccountData } from "../requests/use-account-data";
import { useLiveChanges, useLiveNotice } from "../requests/use-live-changes";
import { useMyBusiness } from "../businesses/business-provider";

export function useRealReservations(seller = false, id?: string) {
  const { business } = useMyBusiness();
  const load = useCallback((client: SupabaseClient<Database>) => readReservations(client, seller, id), [seller, id]);
  const data = useAccountData(`reservations:${seller}:${id ?? "all"}`, load, "No pudimos cargar las reservas.");
  const { notice, show } = useLiveNotice();
  const topic = seller ? business ? `merchant-reservations:${business.id}` : null : data.userId ? `buyer-reservations:${data.userId}` : null;
  const live = useLiveChanges(topic, async (events, sync) => {
    if (!sync && !events.some(event => event.entity === "reservations" && (!id || event.id === id))) return;
    const previous = data.data;
    // Signals omit joins and transition timestamps. Reconcile only this account/resource.
    const next = await data.refresh();
    if (!previous || !next) return;
    if (seller && next.some(row => !previous.some(old => old.id === row.id))) show("🛒 Nueva reserva recibida");
    if (!seller) {
      const changed = next.find(row => previous.some(old => old.id === row.id && old.status !== row.status));
      if (changed?.status === "CONFIRMED") show("✅ Tu reserva fue confirmada");
      else if (changed?.status === "READY") show(changed.delivery_type === "PICKUP" ? "📦 Tu pedido está listo para retirar" : "📦 Tu pedido está listo para enviar");
      else if (changed?.status === "COMPLETED") show("✅ Reserva completada");
      else if (changed?.status === "CANCELLED") show("Reserva cancelada");
    }
  });
  return { ...data, live, notice };
}

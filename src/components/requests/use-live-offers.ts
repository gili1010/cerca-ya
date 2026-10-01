"use client";

import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readRealOffers } from "@/lib/real-offers";
import { money } from "@/lib/products";
import { useAccountData } from "./use-account-data";
import { useLiveChanges, useLiveNotice } from "./use-live-changes";

export function useLiveOffers(requestId?: string, offerId?: string, seller = false) {
  const load = useCallback((client: SupabaseClient<Database>) => readRealOffers(client, requestId, offerId, seller), [requestId, offerId, seller]);
  const data = useAccountData(`offers:${seller}:${requestId ?? ""}:${offerId ?? ""}`, load, "No pudimos cargar las ofertas.");
  const { notice, show } = useLiveNotice();
  const { refresh, patch } = data;
  const topic = seller && offerId ? `merchant-offer:${offerId}` : requestId ? `offers:${requestId}` : null;
  const live = useLiveChanges(topic, async (events, sync) => {
    const relevant = events.filter(event => event.entity !== "radar" && (!requestId || event.request_id === requestId) && (event.entity === "requests" || !offerId || event.id === offerId));
    for (const event of relevant) {
      if (offerId && event.entity === "requests" && event.operation === "UPDATE") {
        if (event.status === "CLOSED") show("El pedido fue cerrado");
        else if (event.status === "CANCELLED") show("El pedido fue cancelado");
      }
    }
    const changed = relevant.filter(event => event.entity === "offers");
    if (!sync && !changed.length) return;
    // Full reconciliation only on join/rejoin, including events lost during disconnect.
    if (sync) {
      const previous = data.data;
      const rows = await refresh();
      if (rows && previous && !seller) {
        const added = rows.find(row => !previous.some(old => old.id === row.id));
        if (added) show(`🎉 Nueva oferta recibida · ${added.business_name} · ${money(added.price)}`);
        else if (rows.some(row => row.status === "WITHDRAWN" && previous.some(old => old.id === row.id && old.status !== "WITHDRAWN"))) show("Oferta retirada");
      }
      return;
    }
    // Preserve the last operation per UUID when multiple events arrive in one burst.
    const latest = new Map(changed.map(event => [event.entity === "offers" ? event.id : "", event]));
    if ([...latest.values()].every(event => event.entity === "offers" && event.operation === "INSERT" && data.data?.some(row => row.id === event.id))) return;
    const onlyRemovals = [...latest.values()].every(event => event.entity === "offers" && (event.operation === "DELETE" || (event.operation === "UPDATE" && event.status === "WITHDRAWN" && data.data?.some(row => row.id === event.id))));
    if (onlyRemovals && data.data) {
      const withdrawn = [...latest.values()].some(event => event.entity === "offers" && event.status === "WITHDRAWN" && data.data?.some(row => row.id === event.id && row.status !== "WITHDRAWN"));
      const patched = patch(rows => rows.filter(row => {
        const event = latest.get(row.id); return !event || event.operation !== "DELETE";
      }).map(row => latest.get(row.id)?.operation === "UPDATE" ? { ...row, status: "WITHDRAWN" as const } : row));
      if (patched) { if (withdrawn) show("Oferta retirada"); return; }
    }
    // INSERT/other UPDATE need joined public business fields absent from the signal.
    // Reconcile this request (or single seller offer), never unrelated offers.
    // Full reconciliation also avoids overwriting newer manual reads with a partial list.
    const previous = data.data;
    const rows = await refresh();
    if (rows && previous) {
      const added = rows.find(row => !previous.some(old => old.id === row.id));
      if (added && !seller) show(`🎉 Nueva oferta recibida · ${added.business_name} · ${money(added.price)}`);
      else if (rows.some(row => row.status === "WITHDRAWN" && previous.some(old => old.id === row.id && old.status !== "WITHDRAWN"))) show("Oferta retirada");
    }
  });
  return { ...data, live, notice };
}

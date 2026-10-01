"use client";

import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { readRadarRequests, readRealRadar, type RealRadarData } from "@/lib/real-radar";
import { useAccountData } from "../requests/use-account-data";
import { useLiveChanges } from "../requests/use-live-changes";

export function useLiveRadar(businessId: string, requestId?: string, businessVersion = "") {
  const load = useCallback((client: SupabaseClient<Database>) => readRealRadar(client, businessId, requestId), [businessId, requestId]);
  const data = useAccountData(`radar:${businessId}:${requestId ?? ""}:${businessVersion}`, load, "No pudimos cargar las oportunidades.");
  const { refresh } = data;
  const live = useLiveChanges(`merchant-radar:${businessId}`, async () => {
    await refresh(async (client, current: RealRadarData | null) => {
      if (!current) return load(client);
      // Broadcast intentionally has no buyer data. Only reread the safe projection;
      // products/categories are unchanged by requests/offers events.
      return { ...current, requests: await readRadarRequests(client, requestId) };
    });
  });
  return { ...data, live };
}

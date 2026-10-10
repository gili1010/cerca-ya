"use client";
import { useCallback } from "react";
import { useMyBusiness } from "@/components/businesses/business-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
export function useMarkStoreShared(businessId: string) {
  const { business, updateSharedAt } = useMyBusiness();
  return useCallback(async (): Promise<string | undefined> => {
    if (business?.id !== businessId) return "No pudimos actualizar el progreso. Volvé a intentar compartir.";
    if (business.store_shared_at) return;
    try {
      const client = getSupabaseBrowserClient(); if (!client) throw new Error("unavailable");
      const { data, error } = await client.rpc("mark_my_store_shared", { p_business_id: businessId });
      if (error || !data) throw new Error("unavailable");
      updateSharedAt(businessId, data);
    } catch { return "La acción se realizó, pero no pudimos actualizar el progreso. Volvé a intentar compartir."; }
  }, [business, businessId, updateSharedAt]);
}

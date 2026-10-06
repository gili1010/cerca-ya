"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { BusinessRow } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getOwnedBusiness } from "@/lib/businesses/client";
import { useAuth } from "../auth/auth-provider";

interface BusinessContextValue {
  business: BusinessRow | null; loading: boolean; error: string;
  refresh: () => Promise<BusinessRow | null>;
  updateSlug: (businessId: string, slug: string) => void;
}
const BusinessContext = createContext<BusinessContextValue | null>(null);
export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id;
  const [snapshot, setSnapshot] = useState<{ userId: string; business: BusinessRow | null; error: string } | null>(null);
  const revision = useRef(0);
  const updateSlug = useCallback((businessId: string, slug: string) => {
    revision.current++;
    setSnapshot(previous => previous && previous.userId === userId && previous.business?.id === businessId
      ? { ...previous, business: { ...previous.business, slug } } : previous);
  }, [userId]);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    if (!userId) return null;
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const business = await getOwnedBusiness(client, userId);
      if (current === revision.current) setSnapshot({ userId, business, error: "" });
      return business;
    } catch {
      if (current === revision.current) setSnapshot({ userId, business: null, error: "No pudimos cargar tu comercio. Volvé a intentar." });
      throw new Error("No pudimos cargar tu comercio.");
    }
  }, [userId]);
  useEffect(() => {
    const reload = () => { if (userId) void refresh().catch(() => {}); };
    reload();
    window.addEventListener("focus", reload);
    return () => { revision.current++; window.removeEventListener("focus", reload); };
  }, [refresh, userId]);
  const current = snapshot?.userId === userId ? snapshot : null;
  return <BusinessContext.Provider value={{ business: current?.business ?? null, error: current?.error ?? "", loading: authLoading || Boolean(userId && !current), refresh, updateSlug }}>{children}</BusinessContext.Provider>;
}
export function useMyBusiness() {
  const value = useContext(BusinessContext);
  if (!value) throw new Error("useMyBusiness requires BusinessProvider");
  return value;
}

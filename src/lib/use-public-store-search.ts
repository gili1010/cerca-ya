"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { searchPublicStores, type StoreSearchBusiness } from "@/lib/public-store-search";

export interface PublicStoreSearchState {
  stores: StoreSearchBusiness[];
  loading: boolean;
  error: string;
  retry: () => void;
}

export function usePublicStoreSearch(query: string, enabled: boolean, hasLocation: boolean): PublicStoreSearchState {
  const term = enabled ? query.trim().slice(0, 160) : "";
  const key = JSON.stringify({ term, hasLocation });
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; stores: StoreSearchBusiness[]; error: string } | null>(null);
  useEffect(() => {
    const parsed: { term: string; hasLocation: boolean } = JSON.parse(key);
    if (!parsed.term) return;
    let live = true;
    let revision = 0;
    let controller: AbortController | null = null;
    async function load() {
      const current = ++revision;
      controller?.abort();
      controller = new AbortController();
      try {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("unavailable");
        const stores = await searchPublicStores(client, parsed.term, parsed.hasLocation, controller.signal);
        if (live && current === revision) setSnapshot({ key, stores, error: "" });
      } catch {
        if (live && current === revision) setSnapshot({ key, stores: [], error: "No pudimos cargar las tiendas. Volvé a intentar en un momento." });
      }
    }
    const timer = setTimeout(() => void load(), 300);
    const focus = () => { clearTimeout(timer); void load(); };
    window.addEventListener("focus", focus);
    return () => { live = false; controller?.abort(); clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [key, attempt]);
  const current = snapshot?.key === key ? snapshot : null;
  return {
    stores: term ? current?.stores ?? [] : [],
    loading: Boolean(term) && !current,
    error: term ? current?.error ?? "" : "",
    retry: () => { setSnapshot(null); setAttempt(value => value + 1); },
  };
}

"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { provinceByCode } from "@/lib/argentina-provinces";
import type { PersonalListingPageOptions } from "@/types/personal-listings";
import { readPersonalListings } from "./client";

/** Una página independiente; no mezcla el total ni el orden del catálogo comercial. */
export function usePublicPersonalListings(options: PersonalListingPageOptions, enabled: boolean) {
  const active = enabled && Boolean(options.locality.trim() && provinceByCode(options.provinceCode));
  const key = JSON.stringify(options);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data: Awaited<ReturnType<typeof readPersonalListings>> | null; error: string } | null>(null);
  useEffect(() => {
    if (!active) return;
    let live = true, revision = 0;
    let controller: AbortController | undefined;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    const parsed: PersonalListingPageOptions = JSON.parse(key);
    async function load() {
      const current = ++revision;
      controller?.abort(); controller = new AbortController();
      if (expiryTimer) clearTimeout(expiryTimer);
      try {
        const client = getSupabaseBrowserClient(); if (!client) throw new Error();
        const data = await readPersonalListings(client, parsed, controller.signal);
        if (!live || current !== revision) return;
        setSnapshot({ key, data, error: "" });
        const expiries = data.items.flatMap(item => item.expires_at ? [Date.parse(item.expires_at)] : []).filter(Number.isFinite);
        if (expiries.length) expiryTimer = setTimeout(() => void load(), Math.min(2147483647, Math.max(1000, Math.min(...expiries) - Date.now())));
      } catch {
        if (live && current === revision) setSnapshot({ key, data: null, error: "No pudimos cargar los artículos particulares. Volvé a intentar." });
      }
    }
    const timer = setTimeout(() => void load(), parsed.query ? 300 : 0);
    const refresh = () => { void load(); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    // Las lecturas vuelven a aplicar elegibilidad del backend, incluso con el mismo total.
    const interval = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 60000);
    window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { live = false; controller?.abort(); clearTimeout(timer); clearInterval(interval); if (expiryTimer) clearTimeout(expiryTimer); window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [key, active, attempt]);
  const current = active && snapshot?.key === key ? snapshot : null;
  return { items: current?.data?.items ?? [], total: current?.data?.total ?? 0,
    loading: active && !current, error: current?.error ?? "", pageSize: options.pageSize ?? 24,
    retry: () => { setSnapshot(null); setAttempt(value => value + 1); } };
}

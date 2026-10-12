"use client";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicCatalog, publicCatalogPageSize, type PublicCatalogOptions } from "@/lib/public-catalog";
import { provinceByCode } from "./argentina-provinces";
import { isCoordinates } from "./location";

export function usePublicCatalog(options: PublicCatalogOptions) {
  const group = options.group ?? "distance";
  const enabled = options.enabled !== false && (group === "distance"
    ? isCoordinates(options.buyerLocation)
    : Boolean(options.locality?.trim() && provinceByCode(options.provinceCode)));
  // A geographical radius change does not invalidate the independent locality page.
  const key = JSON.stringify({ ...options, group, enabled,
    radiusKm: group === "locality" ? 20 : options.radiusKm,
    sort: group === "locality" && options.sort === "distance" ? "recommended" : options.sort,
  });
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data: Awaited<ReturnType<typeof getPublicCatalog>> | null; error: string } | null>(null);
  useEffect(() => {
    let live = true;
    let revision = 0;
    let controller: AbortController | null = null;
    const parsed: PublicCatalogOptions = JSON.parse(key);
    if (parsed.enabled === false) return;
    async function load() {
      const current = ++revision;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      try {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error("unavailable");
        const data = await getPublicCatalog(client, parsed, signal);
        if (live && current === revision) setSnapshot({ key, data, error: "" });
      } catch { if (live && current === revision) setSnapshot({ key, data: null, error: "No pudimos cargar los productos en este momento." }); }
    }
    const timer = setTimeout(() => void load(), parsed.query ? 300 : 0);
    const focus = () => { void load(); };
    window.addEventListener("focus", focus);
    return () => { live = false; controller?.abort(); clearTimeout(timer); window.removeEventListener("focus", focus); };
  }, [key, attempt]);
  const current = enabled && snapshot?.key === key ? snapshot : null;
  return { products: current?.data?.products ?? [], total: current?.data?.total ?? 0, pageSize: current?.data?.pageSize ?? publicCatalogPageSize(options.home === true && !options.query.trim()), error: current?.error ?? "", loading: enabled && !current,
    retry: () => { setSnapshot(null); setAttempt(value => value + 1); } };
}

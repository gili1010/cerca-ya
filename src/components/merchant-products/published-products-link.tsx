"use client";

import Link from "next/link";
import { Package } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useMyBusiness } from "../businesses/business-provider";

export function PublishedProductsLink() {
  const { business, loading, error, refresh } = useMyBusiness();
  const businessId = business?.id;
  const [result, setResult] = useState<{ businessId: string; count: number | null; error: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!businessId) return;
    let live = true;
    let revision = 0;
    async function load() {
      const current = ++revision;
      try {
        const client = getSupabaseBrowserClient();
        if (!client || !businessId) throw new Error("unavailable");
        const { count, error: failure } = await client.from("products").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("active", true);
        if (failure) throw failure;
        if (live && current === revision) setResult({ businessId, count: count ?? 0, error: false });
      } catch { if (live && current === revision) setResult({ businessId: businessId!, count: null, error: true }); }
    }
    void load();
    const focus = () => { void load(); };
    window.addEventListener("focus", focus);
    return () => { live = false; window.removeEventListener("focus", focus); };
  }, [businessId, attempt]);
  const current = result?.businessId === businessId ? result : null;
  return <section className="panel">
    <span className="workspace-icon"><Package size={24} aria-hidden="true" /></span>
    <Link href="/comercio/productos"><strong>Mis productos</strong></Link>
    {loading ? <span role="status">Cargando tu comercio…</span> : error ? <><span role="alert">No pudimos cargar tu comercio.</span><button className="secondary-link" onClick={() => void refresh().catch(() => {})}>Reintentar</button></> : !business ? <span>Creá tu comercio para publicar productos.</span> : current?.error ? <><span role="alert">No pudimos obtener la cantidad publicada.</span><button className="secondary-link" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></> : <span role="status">{current?.count === undefined || current.count === null ? "Cargando productos…" : `${current.count} productos publicados · activos`}</span>}
  </section>;
}

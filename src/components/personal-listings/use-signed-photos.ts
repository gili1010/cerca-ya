"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signPersonalListingImages } from "@/lib/personal-listings/images";

/** URLs en memoria y por sesión; se renuevan antes del vencimiento y al volver a la vista. */
export function useSignedPersonalPhotos(paths: string[]) {
  const { user } = useAuth();
  const key = JSON.stringify([...new Set(paths)].sort());
  const [result, setResult] = useState<{ key: string; account: string | null; urls: Record<string, string>; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const expires = useRef(0);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  useEffect(() => {
    let live = true; let timer: ReturnType<typeof setTimeout> | undefined;
    const account = user?.id ?? null;
    const selected: string[] = JSON.parse(key);
    async function load() {
      try {
        const client = getSupabaseBrowserClient();
        if (!client) throw new Error();
        const signed = await signPersonalListingImages(client, selected);
        if (!live) return;
        expires.current = signed.expiresAt;
        setResult({ key, account, urls: signed.urls, error: signed.unavailable.length ? "Algunas fotos no están disponibles." : "" });
        if (selected.length) timer = setTimeout(load, Math.max(1000, signed.expiresAt - Date.now() - 60000));
      } catch {
        if (!live) return;
        expires.current = 0;
        setResult({ key, account, urls: {}, error: selected.length ? "No pudimos cargar las fotos. Volvé a intentar." : "" });
      }
    }
    void load();
    const focus = () => { if (Date.now() > expires.current - 60000) refresh(); };
    const visible = () => { if (document.visibilityState === "visible") focus(); };
    window.addEventListener("focus", focus);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => { live = false; if (timer) clearTimeout(timer); window.removeEventListener("focus", focus); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [key, user?.id, attempt, refresh]);
  const current = result?.key === key && result.account === (user?.id ?? null) ? result : null;
  return { urls: current?.urls ?? {}, error: current?.error ?? "", loading: !current && paths.length > 0, refresh };
}

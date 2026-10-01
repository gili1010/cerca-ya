"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth } from "../auth/auth-provider";

// Memory-only, account-scoped snapshots. Callers memoize the loader with useCallback.
export function useAccountData<T>(resource: string, load: (client: SupabaseClient<Database>) => Promise<T>, failure: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const key = `${userId}:${resource}`;
  const revision = useRef(0);
  const pendingReads = useRef(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data: T | null; error: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const latest = useRef(snapshot);
  const refresh = useCallback(async (reload?: (client: SupabaseClient<Database>, current: T | null) => Promise<T>) => {
    if (!userId) return null;
    const current = ++revision.current;
    pendingReads.current++;
    setBusy(true);
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const previous = latest.current?.key === key ? latest.current.data : null;
      const data = reload ? await reload(client, previous) : await load(client);
      if (current === revision.current) {
        latest.current = { key, data, error: "" }; setSnapshot(latest.current);
        return data;
      }
    } catch {
      if (current === revision.current) {
        latest.current = { key, data: latest.current?.key === key ? latest.current.data : null, error: failure };
        setSnapshot(latest.current);
      }
    } finally { pendingReads.current--; if (current === revision.current) setBusy(false); }
    return null;
  }, [key, userId, load, failure]);
  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { revision.current++; window.removeEventListener("focus", focus); };
  }, [refresh]);
  const patch = useCallback((update: (data: T) => T) => {
    const previous = latest.current;
    if (pendingReads.current || previous?.key !== key || previous.data === null) return false;
    // Prevent an older in-flight read from overwriting a more recent event.
    revision.current++;
    latest.current = { key, data: update(previous.data), error: "" };
    setSnapshot(latest.current); setBusy(false);
    return true;
  }, [key]);
  const current = snapshot?.key === key ? snapshot : null;
  return { data: current?.data ?? null, error: current?.error ?? "", loading: !current, busy, refresh, patch, userId };
}

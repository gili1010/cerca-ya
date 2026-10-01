"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { readBuyerRequests, type BuyerRequest, type BuyerRequestFilter } from "@/lib/buyer-requests";
import { useLiveChanges, useLiveNotice } from "./use-live-changes";

export function useBuyerRequests(filter: BuyerRequestFilter = "ALL", page = 0, id?: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const { notice, show } = useLiveNotice();
  const key = `${userId}:${filter}:${page}:${id ?? ""}`;
  const [snapshot, setSnapshot] = useState<{ key: string; requests: BuyerRequest[]; total: number; error: string } | null>(null);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    if (!userId) return;
    const current = ++revision.current;
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const data = await readBuyerRequests(client, userId, filter, page, id);
      if (current === revision.current) setSnapshot({ key, ...data, error: "" });
    } catch { if (current === revision.current) setSnapshot({ key, requests: [], total: 0, error: "No pudimos cargar tus pedidos." }); }
  }, [userId, key, filter, page, id]);
  useEffect(() => {
    void refresh();
    const focus = () => { void refresh(); };
    window.addEventListener("focus", focus);
    return () => { revision.current++; window.removeEventListener("focus", focus); };
  }, [refresh]);
  const current = snapshot?.key === key ? snapshot : null;
  const live = useLiveChanges(userId ? `buyer-requests:${userId}` : null, async (events, sync) => {
    const relevant = events.filter(event => event.entity !== "radar" && (!id || event.request_id === id));
    for (const event of relevant) {
      if (event.entity === "requests" && event.operation === "UPDATE") {
        if (event.status === "CLOSED") show("El pedido fue cerrado");
        else if (event.status === "CANCELLED") show("El pedido fue cancelado");
      }
    }
    // List membership, pagination and relational COUNT are authoritative in Postgres.
    // Withdrawal retains the historical count, so no count query is needed for UPDATE.
    const needsRead = relevant.some(event => event.entity === "requests" || (!id && event.entity === "offers" && event.operation !== "UPDATE"));
    if (sync || needsRead) await refresh();
  });
  // One UI refresh at the next visible expiration; never writes EXPIRED to the DB.
  useEffect(() => {
    const future = current?.requests.filter(request => request.status === "OPEN" && Date.parse(request.expires_at) > Date.now()).map(request => Date.parse(request.expires_at));
    if (!future?.length) return;
    const timer = setTimeout(() => void refresh(), Math.min(2147483647, Math.max(1, Math.min(...future) - Date.now() + 100)));
    return () => clearTimeout(timer);
  }, [current, refresh]);
  return { requests: current?.requests ?? [], total: current?.total ?? 0, error: current?.error ?? "", loading: !current, refresh, userId, live, notice };
}

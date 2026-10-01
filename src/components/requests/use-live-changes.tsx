"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Radio } from "lucide-react";
import { listenToChanges, type LiveChange, type LiveState } from "@/lib/realtime";
import { useAuth } from "../auth/auth-provider";

// Batch bursts; at most one handler runs at once. Events arriving during a read
// become one follow-up batch. No polling and no lost updates from overlapping reads.
export function useLiveChanges(topic: string | null, handle: (events: LiveChange[], sync: boolean) => void | Promise<void>) {
  const { user } = useAuth();
  const userId = user?.id;
  const callback = useRef(handle);
  useEffect(() => { callback.current = handle; }, [handle]);
  const [connection, setConnection] = useState<{ key: string; state: LiveState } | null>(null);
  const key = `${userId}:${topic}`;
  useEffect(() => {
    if (!userId || !topic) return;
    let alive = true, running = false, needsSync = false;
    let pending: LiveChange[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => {
      timer = undefined;
      if (!alive || running) return;
      running = true;
      const events = pending; pending = [];
      const sync = needsSync; needsSync = false;
      try { await callback.current(events, sync); } catch { /* Read hooks keep their friendly error and manual fallback. */ }
      finally { running = false; if (alive && (pending.length || needsSync)) schedule(); }
    };
    const schedule = () => { if (!running && !timer) timer = setTimeout(() => void flush(), 180); };
    const stop = listenToChanges(userId, topic, {
      change: event => { if (alive) { pending.push(event); schedule(); } },
      state: state => { if (alive) setConnection({ key, state }); },
      sync: () => { if (alive) { needsSync = true; schedule(); } },
    });
    return () => { alive = false; if (timer) clearTimeout(timer); pending = []; stop(); };
  }, [userId, topic, key]);
  return connection?.key === key ? connection.state : "connecting";
}

export function useLiveNotice() {
  const { user } = useAuth();
  const userId = user?.id;
  const [notice, setNotice] = useState<{ userId?: string; text: string; sequence: number } | null>(null);
  const show = useCallback((text: string) => setNotice(current => ({ userId, text, sequence: (current?.sequence ?? 0) + 1 })), [userId]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6500);
    return () => clearTimeout(timer);
  }, [notice]);
  return { notice: notice?.userId === userId ? notice?.text ?? "" : "", show };
}
export function LiveFeedback({ state, notice = "" }: { state: LiveState; notice?: string }) {
  return <>{notice && <p className="live-notice" role="status" aria-live="polite"><Bell size={18} aria-hidden="true" /><span>{notice}</span></p>}{state === "reconnecting" && <p className="live-notice live-reconnecting" role="status"><Radio size={18} aria-hidden="true" /><span>Reconectando las actualizaciones en vivo. Podés usar Actualizar.</span></p>}</>;
}

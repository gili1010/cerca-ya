"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase/client";
import { isUuid } from "./real-offers";

export type LiveChange = { entity: "radar"; operation: "REFRESH" } | {
  entity: "requests" | "offers"; operation: "INSERT" | "UPDATE" | "DELETE";
  id: string; request_id: string; status: string;
} | {
  entity: "reservations"; operation: "INSERT" | "UPDATE" | "DELETE";
  id: string; status: string; request_id?: never;
};
export type LiveState = "connecting" | "connected" | "reconnecting";
type Listener = { change: (event: LiveChange) => void; state: (state: LiveState) => void; sync: () => void };
type Entry = { channel: RealtimeChannel | null; listeners: Set<Listener>; state: LiveState; disposed: boolean; retry?: ReturnType<typeof setTimeout>; attempts: number };
const channels = new Map<string, Entry>();
const retiring = new Map<string, Promise<unknown>>();

function parseChange(value: unknown): LiveChange | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.entity === "radar" && row.operation === "REFRESH") return { entity: "radar", operation: "REFRESH" };
  if (row.entity === "reservations" && ["INSERT", "UPDATE", "DELETE"].includes(String(row.operation)) && typeof row.id === "string" && isUuid(row.id) && typeof row.status === "string") {
    return { entity: "reservations", operation: row.operation as "INSERT" | "UPDATE" | "DELETE", id: row.id, status: row.status };
  }
  if ((row.entity !== "requests" && row.entity !== "offers") || !["INSERT", "UPDATE", "DELETE"].includes(String(row.operation))
    || typeof row.id !== "string" || !isUuid(row.id) || typeof row.request_id !== "string" || !isUuid(row.request_id) || typeof row.status !== "string") return null;
  return { entity: row.entity, operation: row.operation as "INSERT" | "UPDATE" | "DELETE", id: row.id, request_id: row.request_id, status: row.status };
}

// One channel per account + topic in this browser, even with multiple consumers.
// All channels are private; the database authorizes membership. No client publishing.
export function listenToChanges(userId: string, topic: string, listener: Listener) {
  const client = getSupabaseBrowserClient();
  if (!client) { listener.state("reconnecting"); return () => {}; }
  const key = `${userId}:${topic}`;
  let entry = channels.get(key);
  if (!entry) {
    entry = { channel: null, listeners: new Set(), state: "connecting", disposed: false, attempts: 0 };
    channels.set(key, entry);
    const active = entry;
    const setState = (state: LiveState) => { active.state = state; active.listeners.forEach(item => item.state(state)); };
    const connect = async () => {
      if (active.disposed) return;
      try {
        await retiring.get(topic);
        if (active.disposed) return;
        // Uses the authenticated SDK token; never a privileged key or persisted copy.
        await client.realtime.setAuth();
        if (active.disposed) return;
        const channel = client.channel(topic, { config: { private: true } });
        active.channel = channel;
        channel.on("broadcast", { event: "change" }, message => {
          if (active.disposed || active.channel !== channel) return;
          const change = parseChange(message.payload);
          if (change) active.listeners.forEach(item => item.change(change));
        }).subscribe(status => {
          if (active.disposed || active.channel !== channel) return;
          if (status === "SUBSCRIBED") {
            if (active.retry) { clearTimeout(active.retry); active.retry = undefined; }
            active.attempts = 0; setState("connected");
            // Covers the initial read/join gap and changes missed while disconnected.
            active.listeners.forEach(item => item.sync());
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") retry();
        });
      } catch { retry(); }
    };
    const retry = () => {
      if (active.disposed || active.retry) return;
      setState("reconnecting");
      active.retry = setTimeout(() => {
        active.retry = undefined;
        const previous = active.channel; active.channel = null;
        // Serialize removal/rejoin; no duplicate channel after a timeout.
        void (previous ? client.removeChannel(previous).catch(() => {}) : Promise.resolve()).then(connect);
      }, Math.min(30000, 1000 * 2 ** Math.min(active.attempts++, 5)));
    };
    // Register the first consumer before an async join can complete.
    entry.listeners.add(listener);
    void connect();
  } else entry.listeners.add(listener);
  listener.state(entry.state);
  const active = entry;
  return () => {
    active.listeners.delete(listener);
    if (active.listeners.size) return;
    active.disposed = true;
    if (active.retry) clearTimeout(active.retry);
    channels.delete(key);
    if (active.channel) {
      const removed = client.removeChannel(active.channel).catch(() => {});
      retiring.set(topic, removed);
      void removed.finally(() => { if (retiring.get(topic) === removed) retiring.delete(topic); });
    }
  };
}

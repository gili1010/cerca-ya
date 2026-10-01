"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "./config";

let client: SupabaseClient<Database> | null = null;

// Supabase SSR manages the session cookies, refresh and cross-tab auth events.
export function getSupabaseBrowserClient(): SupabaseClient<Database> | null {
  if (typeof window === "undefined") return null;
  const config = getSupabaseConfig();
  if (!config) return null;
  client ??= createBrowserClient<Database>(config.url, config.key);
  return client;
}

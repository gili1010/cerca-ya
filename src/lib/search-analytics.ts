"use client";
import { getSupabaseBrowserClient } from "./supabase/client";
export interface SearchMeasurement { id: string; query: string; resultCount: number; categoryId: string | null; locality: string | null }
export async function recordSearch(measurement: SearchMeasurement) {
  try {
    const client = getSupabaseBrowserClient(); if (!client) return;
    // Sin sesión, coordenadas ni identidad en el payload de analítica.
    await client.rpc("record_search_event", {
      p_id: measurement.id, p_query: measurement.query, p_results_count: measurement.resultCount,
      p_category_id: measurement.categoryId, p_locality: measurement.locality,
    });
  } catch { /* La analítica nunca interrumpe los resultados ni muestra errores. */ }
}

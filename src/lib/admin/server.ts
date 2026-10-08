import "server-only";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { adminPageSize, type AdminFilters } from "./types";
import type { SupportFilters } from "./phase2-types";

export async function requireAdmin(returnTo: string) {
  await requireUser(returnTo);
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("No pudimos verificar tu acceso. Volvé a intentar.");
  const { data, error } = await client.rpc("is_admin", {});
  if (error) throw new Error("No pudimos verificar tu acceso. Volvé a intentar.");
  if (!data) redirect("/");
  return client;
}

// Cada pantalla usa este acceso además del control del layout. Cada RPC también autoriza.
export async function readAdmin<T>(section: string, returnTo: string, filters?: AdminFilters, id?: string): Promise<T> {
  const client = await requireAdmin(returnTo);
  const { data, error } = await client.rpc("admin_read", {
    p_section: section, p_query: filters?.query ?? "", p_business_query: filters?.businessQuery ?? "",
    p_state: filters?.state ?? "all", p_offset: ((filters?.page ?? 1) - 1) * adminPageSize,
    p_limit: adminPageSize, ...(id ? { p_id: id } : {}),
  });
  if (error || !data) throw new Error("No pudimos cargar esta sección. Volvé a intentar.");
  return data as T;
}

export async function readAdminPhase2<T>(section: string, returnTo: string, filters?: SupportFilters, id?: string, page = 1): Promise<T> {
  const client = await requireAdmin(returnTo);
  const { data, error } = await client.rpc("admin_read_phase2", {
    p_section: section, p_filters: {
      q: filters?.q ?? "", buyer: filters?.buyer ?? "", business: filters?.business ?? "",
      state: filters?.state ?? "all", mode: filters?.mode ?? "all", from: filters?.from ?? "", to: filters?.to ?? "",
      offset: ((filters?.page ?? page) - 1) * adminPageSize, limit: adminPageSize,
    }, ...(id ? { p_id: id } : {}),
  });
  if (error || !data) throw new Error("No pudimos cargar esta sección. Volvé a intentar.");
  return data as T;
}

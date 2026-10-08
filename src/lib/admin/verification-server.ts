import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BusinessVerification } from "./verification-types";
import { logAdminRpcError } from "./rpc-diagnostics";
function validVerification(value: unknown): value is BusinessVerification {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.verified === "boolean"
    && (row.verified_at === null || typeof row.verified_at === "string" && Number.isFinite(Date.parse(row.verified_at)))
    && (row.verified_by === null || typeof row.verified_by === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.verified_by))
    && (row.admin_name === null || typeof row.admin_name === "string");
}
export async function readBusinessVerification(client: SupabaseClient<Database>, id: string): Promise<BusinessVerification> {
  try {
    const { data, error } = await client.rpc("admin_read_business_verification", { p_business_id: id });
    if (error) logAdminRpcError("business verification: admin_read_business_verification", error);
    else if (validVerification(data)) return data;
    else logAdminRpcError("business verification: response", { code: "INVALID_RPC_RESPONSE", message: "El JSON no cumple el contrato de verificación.", details: "verified debe ser boolean; fecha, administrador y nombre pueden ser null.", hint: "Un comercio sin historial debe devolver verified=false y metadatos null." });
  } catch (error) { logAdminRpcError("business verification: request", error); }
  throw new Error("No pudimos cargar la verificación del comercio. Volvé a intentar.");
}

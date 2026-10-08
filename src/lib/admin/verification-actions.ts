"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./server";
import { logAdminRpcError } from "./rpc-diagnostics";
import { verificationRemovalReasons } from "./verification-types";
export async function setBusinessVerification(input: { id: string; verified: boolean; reason: string; note: string }): Promise<{ error?: string; success?: true }> {
  const client = await requireAdmin("/admin/comercios");
  if (!input || typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)
    || typeof input.verified !== "boolean" || typeof input.reason !== "string" || typeof input.note !== "string"
    || input.note.trim().length>500 || input.reason.length>100
    || (!input.verified && !verificationRemovalReasons.some(reason => reason===input.reason))) return { error: "Revisá el motivo y la nota antes de continuar." };
  try {
    const { error } = await client.rpc("admin_set_business_verification", { p_business_id: input.id, p_verified: input.verified, p_reason: input.verified ? "" : input.reason, p_note: input.note.trim() });
    if (error) { logAdminRpcError("business verification: admin_set_business_verification", error); return { error: "No pudimos cambiar la verificación. Actualizá la página y volvé a intentar." }; }
    revalidatePath("/admin", "layout");
    revalidatePath("/tienda/[slug]", "page");
    revalidatePath("/");
    revalidatePath("/comercio");
    return { success: true };
  } catch (error) { logAdminRpcError("business verification: update", error); return { error: "No pudimos cambiar la verificación. Revisá tu sesión y volvé a intentar." }; }
}

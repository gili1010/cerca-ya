"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "./server";
import { adminReasons, type AdminEntity } from "./types";

export async function setAdminResourceStatus(input: { entity: AdminEntity; id: string; blocked: boolean; reason: string; note: string }): Promise<{ error?: string; success?: true }> {
  // Autorización fuera del catch: los redirects de Auth deben llegar a Next.js.
  const client = await requireAdmin("/admin");
  if (!input || !["business", "product"].includes(input.entity) || typeof input.id !== "string"
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.id)
    || typeof input.blocked !== "boolean" || typeof input.reason !== "string" || typeof input.note !== "string"
    || input.note.trim().length > 500 || input.reason.length > 100
    || (input.blocked && !adminReasons.some(reason => reason === input.reason))) {
    return { error: "Revisá el recurso y seleccioná un motivo válido." };
  }
  try {
    const { error } = await client.rpc("admin_set_resource_status", {
      p_entity: input.entity, p_id: input.id, p_blocked: input.blocked,
      p_reason: input.reason.trim(), p_note: input.note.trim(),
    });
    if (error) return { error: "No fue posible cambiar el estado. Actualizá la página e intentá nuevamente." };
    revalidatePath("/admin", "layout");
    return { success: true };
  } catch {
    return { error: "No fue posible cambiar el estado. Revisá tu conexión e intentá nuevamente." };
  }
}

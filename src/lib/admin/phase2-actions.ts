"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./server";
import { validAdminId, userSuspensionReasons } from "./phase2-types";

export async function setUserSuspension(input: { id: string; suspended: boolean; reason: string; note: string }): Promise<{ error?: string; success?: true }> {
  const client = await requireAdmin("/admin/usuarios");
  if (!input || !validAdminId(input.id) || typeof input.suspended !== "boolean" || typeof input.reason !== "string" || typeof input.note !== "string" || input.note.length > 500 || input.reason.length > 100 || (input.suspended && !userSuspensionReasons.some(reason => reason === input.reason))) return { error: "Revisá el motivo y la nota." };
  try {
    const { error } = await client.rpc("admin_set_user_suspension", { p_user_id: input.id, p_suspended: input.suspended, p_reason: input.reason, p_note: input.note.trim() });
    if (error) return { error: error.message.includes("USER_HAS_ACTIVE_ORDERS") ? "No podés suspender esta cuenta mientras tenga pedidos activos. Resolvé primero los pedidos pendientes." : error.message.includes("admin_user_protected") ? "Las cuentas administradoras no pueden suspenderse desde este panel." : "No pudimos cambiar el estado del usuario. Volvé a intentar." };
    revalidatePath("/admin", "layout"); return { success: true };
  } catch { return { error: "No pudimos cambiar el estado. Revisá tu conexión." }; }
}
export async function resolveAdminReport(input: { id: string; status: "RESOLVED" | "DISMISSED"; note: string }): Promise<{ error?: string; success?: true }> {
  const client = await requireAdmin("/admin/reportes");
  if (!input || !validAdminId(input.id) || !["RESOLVED", "DISMISSED"].includes(input.status) || typeof input.note !== "string" || input.note.length > 500) return { error: "Revisá la nota y el estado." };
  try {
    const { error } = await client.rpc("admin_resolve_report", { p_report_id: input.id, p_status: input.status, p_note: input.note.trim() });
    if (error) return { error: error.message.includes("report_already_closed") ? "Este reporte ya fue atendido. Actualizá la página." : "No pudimos actualizar el reporte. Volvé a intentar." };
    revalidatePath("/admin", "layout"); return { success: true };
  } catch { return { error: "No pudimos actualizar el reporte. Revisá tu conexión." }; }
}

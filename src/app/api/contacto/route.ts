import { createSupabaseServerClient } from "@/lib/supabase/server";
import { validateContact } from "@/lib/support/contact";
import { contactServerClient, sendContactEmail } from "@/lib/support/contact-server";
export const runtime = "nodejs";
function reply(status: number) { return Response.json({ ok: status === 200 }, { status, headers: { "Cache-Control": "no-store" } }); }
export async function POST(request: Request) {
  // Formulario propio; no se permite enviar desde otros sitios con cookies.
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply(403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply(415);
  try {
    // Límite real del cuerpo, también cuando falta Content-Length.
    const reader = request.body?.getReader(); if (!reader) return reply(400);
    const chunks: Uint8Array[] = []; let length = 0;
    while (true) {
      const part = await reader.read(); if (part.done) break;
      length += part.value.byteLength;
      if (length > 16384) { await reader.cancel(); return reply(413); }
      chunks.push(part.value);
    }
    const body = Buffer.concat(chunks).toString("utf8");
    let raw: unknown;
    try { raw = JSON.parse(body); } catch { return reply(400); }
    if (!raw || typeof raw !== "object") return reply(400);
    const trap = (raw as Record<string, unknown>).website;
    if (typeof trap !== "string") return reply(400);
    if (trap.trim()) return reply(200); // No guardar ni enviar mensajes de bots.
    const data = validateContact(raw); if (!data) return reply(400);
    const sessionClient = await createSupabaseServerClient();
    if (!sessionClient) return reply(503);
    const { data: auth, error: authError } = await sessionClient.auth.getUser();
    // Una cookie inválida no se acepta como identidad autenticada.
    const userId = authError ? null : auth.user?.id ?? null;
    const client = contactServerClient();
    const { data: id, error } = await client.rpc("create_contact_request", { p_input: { ...data }, p_user_id: userId });
    if (error || !id) return reply(error?.message === "CONTACT_RATE_LIMIT" ? 429 : 503);
    await sendContactEmail(data, userId, id);
    return reply(200);
  } catch { return reply(503); }
}

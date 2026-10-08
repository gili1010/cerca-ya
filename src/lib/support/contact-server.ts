import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ContactInput } from "./contact";
export function contactServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!url || !key) throw new Error("contact_unavailable");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
export async function sendContactEmail(data: ContactInput, userId: string | null, id: string) {
  const key = process.env.RESEND_API_KEY?.trim();
  const recipient = process.env.CONTACT_RECIPIENT_EMAIL?.trim();
  const from = process.env.CONTACT_FROM_EMAIL?.trim();
  if (!key || !recipient || !from) { console.warn("Contacto guardado; envío de email no configurado."); return; }
  const text = ["Nueva consulta desde CercaYa", `Referencia interna: ${id}`, `Nombre: ${data.name}`, `Método preferido: ${data.preferred_contact === "PHONE" ? "WhatsApp / teléfono" : "Email"}`, `Teléfono: ${data.phone || "—"}`, `Email: ${data.email || "—"}`, `Motivo: ${data.reason}`, `Pedido: ${data.order_reference || "—"}`, `Fecha: ${new Date().toISOString()}`, ...(userId ? [`User ID: ${userId}`] : []), "", "Mensaje:", data.message].join("\n");
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `contact-${id}` },
      body: JSON.stringify({ from, to: [recipient], subject: `[CercaYa] Nueva consulta — ${data.reason}`, text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) console.warn("Contacto guardado; el proveedor de email rechazó el envío.");
  } catch { console.warn("Contacto guardado; no se pudo completar el envío de email."); }
}

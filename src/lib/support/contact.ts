export const contactReasons = ["Problema con un pedido", "Problema con mi cuenta", "Problema con mi comercio", "Recuperar acceso", "Privacidad / mis datos", "Reportar un problema", "Otro"] as const;
export interface ContactInput { name: string; preferred_contact: "PHONE" | "EMAIL"; phone: string; email: string; reason: string; order_reference: string; message: string }
export function validateContact(value: unknown): ContactInput | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const names = ["name", "preferred_contact", "phone", "email", "reason", "order_reference", "message"] as const;
  if (names.some(key => typeof source[key] !== "string")) return null;
  const data = Object.fromEntries(names.map(key => [key, (source[key] as string).trim()])) as unknown as ContactInput;
  if (!data.name || data.name.length > 120 || data.phone.length > 40 || data.email.length > 254 || data.order_reference.length > 80 || !data.message || data.message.length > 2000) return null;
  if (!contactReasons.some(reason => reason === data.reason) || !["PHONE", "EMAIL"].includes(data.preferred_contact)) return null;
  const validPhone = /^[+\d()\s.-]+$/.test(data.phone) && data.phone.replace(/\D/g, "").length >= 8 && data.phone.replace(/\D/g, "").length <= 15;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  if ((data.phone && !validPhone) || (data.email && !validEmail) || (data.preferred_contact === "PHONE" ? !validPhone : !validEmail)) return null;
  return data;
}

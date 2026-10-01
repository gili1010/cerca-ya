/** Argentina is the default country. Area code + subscriber number has 10 digits.
 * Only complete Argentine numbers are accepted; never guess a missing area code.
 * Preserve the mobile 9 when it was explicitly included after country code 54.
 */
export function normalizeArgentinaPhone(value: string | null | undefined): string | null {
  const input = value?.trim() ?? "";
  if (!/^\+?[\d ()-]+$/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  const international = input.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^54(?:9)?[1-9]\d{9}$/.test(digits)) return digits;
  if (international) return null;
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9]\d{9}$/.test(digits) ? `54${digits}` : null;
}

/** WhatsApp requires 54 + mobile marker 9 + the ten-digit national number. */
export function argentinaWhatsAppNumber(value: string | null | undefined): string | null {
  const phone = normalizeArgentinaPhone(value);
  if (!phone) return null;
  return phone.length === 12 ? `549${phone.slice(2)}` : phone;
}

export function argentinaWhatsAppUrl(value: string | null | undefined, message: string): string | null {
  const phone = argentinaWhatsAppNumber(value);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}` : null;
}

export function formatArgentinaPhone(value: string | null | undefined): string {
  const phone = normalizeArgentinaPhone(value);
  return phone ? `+${phone}` : value?.trim() || "Sin informar";
}

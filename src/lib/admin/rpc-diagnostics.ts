import "server-only";

// Sólo campos técnicos. Nunca pasar argumentos RPC, sesiones ni el JSON de datos.
function safeDiagnostic(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value
    .replace(/Failing row contains[^\n]*/gi, "[fila omitida]")
    .replace(/(?:Bearer\s+)?eyJ[\w.-]+/g, "[token omitido]")
    .replace(/\b(?:sb_secret_|sb_publishable_|re_)[A-Za-z0-9_-]+/g, "[clave omitida]")
    .replace(/https?:\/\/[^\s]+/gi, "[URL omitida]")
    .replace(/[^\s<>"']+@[^\s<>"']+\.[^\s<>"']+/g, "[email omitido]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[UUID omitido]")
    .replace(/'[^']*'/g, "'[valor omitido]'")
    .slice(0, 1200);
}
export function logAdminRpcError(operation: string, error: unknown) {
  const fields = error && typeof error === "object" ? error as Record<string, unknown> : {};
  console.error(`[${operation}]`, {
    code: safeDiagnostic(fields.code), message: safeDiagnostic(fields.message),
    details: safeDiagnostic(fields.details), hint: safeDiagnostic(fields.hint),
  });
}

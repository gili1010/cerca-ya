export function safeRedirect(value: unknown, fallback = "/cuenta"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    const url = new URL(value, "https://cercaya.invalid");
    if (url.origin !== "https://cercaya.invalid" || /^\/(?:login|registro|auth)(?:\/|$)/.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
export const loginUrl = (target: string) => `/login?redirect=${encodeURIComponent(safeRedirect(target))}`;

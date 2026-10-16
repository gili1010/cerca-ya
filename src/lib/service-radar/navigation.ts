import { isServiceId } from "@/lib/services/contracts";

const paths = ["/mis-solicitudes-servicio", "/radar-servicios", "/mis-propuestas-servicio"];
export function radarReturnTo(value: string | null | undefined, fallback = "/mis-solicitudes-servicio") {
 if (!value || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return fallback;
 try {
   const url = new URL(value, "https://cercaya.invalid"); if (url.origin !== "https://cercaya.invalid" || !paths.includes(url.pathname)) return fallback;
   const params = new URLSearchParams();
   const page = url.searchParams.get("page"); if (page && /^\d+$/.test(page)) params.set("page", String(Math.min(Number(page),100000)));
   const category = url.searchParams.get("category"); if (url.pathname === "/radar-servicios" && isServiceId(category)) params.set("category", category);
   return `${url.pathname}${params.size ? `?${params}` : ""}`;
 } catch { return fallback; }
}
export function radarPage(params: URLSearchParams) { const raw = params.get("page") ?? "0"; return /^\d+$/.test(raw) ? Math.min(Number(raw),100000) : 0; }
export function setRadarParams(patch: Record<string, string>) {
 const params = new URLSearchParams(window.location.search);
 for (const [key,value] of Object.entries(patch)) { if (value) params.set(key,value); else params.delete(key); }
 window.history.replaceState(null,"",`${window.location.pathname}${params.size?`?${params}`:""}`);
}

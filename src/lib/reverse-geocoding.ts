import { isCoordinates, type Coordinates } from "./location";
import { normalizePlace, resolveProvince } from "./argentina-provinces";

export interface CanonicalPlace { locality: string; province: string; provinceCode: string; countryCode: "AR" }
function parsePlace(value: unknown): CanonicalPlace | null {
  if (typeof value !== "object" || value === null) return null;
  const fields = value as Record<string, unknown>;
  if (typeof fields.country_code !== "string" || fields.country_code.toUpperCase() !== "AR") return null;
  const province = resolveProvince(fields.state, fields.state_code);
  const locality = ["city", "town", "village", "municipality"].map(key => fields[key]).find(value => typeof value === "string" && value.trim());
  if (!province || typeof locality !== "string" || locality.trim().length > 120) return null;
  return { locality: locality.trim().replace(/\s+/g, " "), province: province.name, provinceCode: province.code, countryCode: "AR" };
}
async function geographicRequest(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<unknown[]> {
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim();
  if (!apiKey) throw new Error("No pudimos buscar localidades en este momento.");
  const url = new URL(`https://api.geoapify.com/v1/geocode/${endpoint}`);
  url.search = new URLSearchParams({ ...params, format: "json", lang: "es", apiKey }).toString();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" });
    if (!response.ok) throw new Error("provider_unavailable");
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("results" in data) || !Array.isArray(data.results)) throw new Error("provider_invalid_response");
    return data.results;
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}
export async function resolveCanonicalPlace(point: Coordinates, signal?: AbortSignal): Promise<CanonicalPlace | null> {
  if (!isCoordinates(point)) return null;
  const results = await geographicRequest("reverse", { lat: String(point.latitude), lon: String(point.longitude), type: "city", limit: "1" }, signal);
  return parsePlace(results[0]);
}
export async function searchLocalities(text: string, provinceCode: string, signal?: AbortSignal): Promise<CanonicalPlace[]> {
  const province = resolveProvince(null, provinceCode);
  if (!province || text.trim().length < 2) return [];
  const results = await geographicRequest("autocomplete", { text: `${text.trim()}, ${province.name}`, type: "city", filter: "countrycode:ar", limit: "10" }, signal);
  const places = results.flatMap(value => { const place = parsePlace(value); return place?.provinceCode === provinceCode ? [place] : []; });
  return [...new Map(places.map(place => [`${place.provinceCode}:${place.locality}`, place])).values()];
}
/** Presentation only; never replaces device coordinates. */
export async function resolveLocality(point: Coordinates): Promise<string | null> {
  try { return (await resolveCanonicalPlace(point))?.locality ?? null; } catch { return null; }
}


export interface CanonicalAddress extends CanonicalPlace, Coordinates { address: string }
/** Conservative acceptance: street centroids and administrative areas are never shop points. */
export function parsePreciseAddress(value: unknown, context?: Pick<CanonicalPlace, "locality" | "provinceCode">): CanonicalAddress | null {
  const place = parsePlace(value);
  if (!place || typeof value !== "object" || value === null) return null;
  const fields = value as Record<string, unknown>;
  if (context && (place.provinceCode !== context.provinceCode || normalizePlace(place.locality) !== normalizePlace(context.locality))) return null;
  if (!["building", "housenumber", "amenity", "address"].includes(String(fields.result_type))) return null;
  if (typeof fields.street !== "string" || !fields.street.trim() || typeof fields.housenumber !== "string" || !fields.housenumber.trim()) return null;
  const rank = typeof fields.rank === "object" && fields.rank !== null ? fields.rank as Record<string, unknown> : {};
  if (typeof rank.confidence !== "number" || !Number.isFinite(rank.confidence) || rank.confidence < 0.9 || rank.confidence > 1) return null;
  if (typeof rank.confidence_building_level === "number" && (!Number.isFinite(rank.confidence_building_level) || rank.confidence_building_level < 0.9 || rank.confidence_building_level > 1)) return null;
  if (typeof fields.lat !== "number" || typeof fields.lon !== "number") return null;
  const point = { latitude: fields.lat, longitude: fields.lon };
  const address = `${fields.street.trim()} ${fields.housenumber.trim()}`;
  if (!isCoordinates(point) || address.length > 240) return null;
  return { ...place, ...point, address };
}
export async function searchAddresses(text: string, context: CanonicalPlace, signal?: AbortSignal): Promise<CanonicalAddress[]> {
  if (text.trim().length < 3) return [];
  const results = await geographicRequest("autocomplete", {
    text: `${text.trim()}, ${context.locality}, ${context.province}, Argentina`, filter: "countrycode:ar", limit: "10",
  }, signal);
  const addresses = results.flatMap(result => { const address = parsePreciseAddress(result, context); return address ? [address] : []; });
  return [...new Map(addresses.map(address => [address.address, address])).values()];
}
/** One reverse request; keeps device coordinates, with an optional useful postal label. */
export async function resolveBusinessPlace(point: Coordinates): Promise<(CanonicalPlace & { address?: string }) | null> {
  if (!isCoordinates(point)) return null;
  const results = await geographicRequest("reverse", { lat: String(point.latitude), lon: String(point.longitude), limit: "1" });
  const place = parsePlace(results[0]);
  if (!place) return null;
  const address = parsePreciseAddress(results[0]);
  return { ...place, ...(address ? { address: address.address } : {}) };
}

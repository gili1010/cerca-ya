import { isCoordinates, type Coordinates } from "./location";

/** Presentation only: returns a locality, never replaces the device coordinates. */
export async function resolveLocality(point: Coordinates): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_GEOAPIFY_API_KEY?.trim();
  if (!apiKey || !isCoordinates(point)) return null;

  const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
  url.search = new URLSearchParams({
    lat: String(point.latitude),
    lon: String(point.longitude),
    type: "city",
    format: "json",
    lang: "es",
    limit: "1",
    apiKey,
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    // One request, no retries. Do not send session cookies or the page URL.
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data !== "object" || data === null || !("results" in data) || !Array.isArray(data.results)) return null;
    const address: unknown = data.results[0];
    if (typeof address !== "object" || address === null) return null;
    const fields = address as Record<string, unknown>;
    for (const field of ["city", "town", "village", "municipality"]) {
      const value = fields[field];
      if (typeof value === "string" && value.trim()) return value.trim().slice(0, 160);
    }
    return null;
  } catch {
    // Missing coverage, network failures and timeouts all keep the generic label.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

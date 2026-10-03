import { isCoordinates, type Coordinates } from "./location";

const storageKey = "cercaya.buyer-location.v1";
export interface SavedBuyerLocation extends Coordinates { locality: string | null; updatedAt: number }

function parseLocation(raw: string | null, legacy = false): SavedBuyerLocation | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!isCoordinates(value)) return null;
    const updatedAt = "updatedAt" in value ? value.updatedAt : legacy ? Date.now() : null;
    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) return null;
    const locality = "locality" in value && typeof value.locality === "string" ? value.locality.trim().slice(0, 160) || null : null;
    return { latitude: value.latitude, longitude: value.longitude, locality, updatedAt };
  } catch { return null; }
}

export function saveBuyerLocation(location: SavedBuyerLocation): void {
  try { localStorage.setItem(storageKey, JSON.stringify(location)); } catch { /* Keep working in memory when storage is blocked. */ }
}

export function readBuyerLocation(): SavedBuyerLocation | null {
  try {
    const raw = localStorage.getItem(storageKey);
    const saved = parseLocation(raw);
    if (saved) return saved;
    if (raw) localStorage.removeItem(storageKey);
  } catch { /* Try the previous session-only record if available. */ }
  try {
    const legacy = parseLocation(sessionStorage.getItem(storageKey), true);
    sessionStorage.removeItem(storageKey);
    if (legacy) saveBuyerLocation(legacy);
    return legacy;
  } catch { return null; }
}

export function removeBuyerLocation(): void {
  try { localStorage.removeItem(storageKey); } catch { /* Storage can be blocked. */ }
  try { sessionStorage.removeItem(storageKey); } catch { /* Also remove the previous session-only record. */ }
}

import type { Business, Request } from "../types/requests";

// Adapter boundary: replace with coarse, privacy-preserving distance estimates later.
export function approximateRequestDistance(request: Request, business: Business): number {
  return request.approximateDistanceKm ?? business.distanceKm;
}

export function isRequestActive(request: Request, now: number): boolean {
  return request.status === "OPEN" && (!request.expiresAt || Date.parse(request.expiresAt) > now);
}

export function canBusinessRespond(request: Request, business: Business, now: number): boolean {
  return isRequestActive(request, now) && approximateRequestDistance(request, business) <= request.radiusKm;
}

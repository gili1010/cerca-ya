import { isCoordinates, type Coordinates } from "./location";

// Great-circle distance, not a road route or an estimate of travel time.
export function distanceKm(from: Coordinates, to: Coordinates): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const a = Math.sin(radians(to.latitude - from.latitude) / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude))
    * Math.sin(radians(to.longitude - from.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

export function businessDistance(buyer: Coordinates | null, business: { latitude: number | null; longitude: number | null } | undefined): number | null {
  return isCoordinates(buyer) && isCoordinates(business) ? distanceKm(buyer, business) : null;
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`;
}

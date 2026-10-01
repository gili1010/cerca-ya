"use client";

import { businessDistance, formatDistance } from "@/lib/distance";
import { useUserLocation } from "./user-location-provider";

export function BusinessDistance({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const { coordinates } = useUserLocation();
  const km = businessDistance(coordinates, { latitude, longitude });
  return km === null ? null : <p>📍 A {formatDistance(km)} de vos</p>;
}

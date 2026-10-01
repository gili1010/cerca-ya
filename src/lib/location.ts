export interface Coordinates { latitude: number; longitude: number }

export function isCoordinates(value: unknown): value is Coordinates {
  if (typeof value !== "object" || value === null) return false;
  const point = value as Record<string, unknown>;
  return typeof point.latitude === "number" && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && typeof point.longitude === "number" && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

// Called only from explicit user actions, never on mount or navigation.
export function requestCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("No pudimos obtener tu ubicación. Tu navegador no admite esta función."));
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      const point = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      if (isCoordinates(point)) resolve(point);
      else reject(new Error("No pudimos obtener tu ubicación."));
    }, error => {
      const message = error.code === 1 ? "Permití el acceso a la ubicación para usar esta función."
        : error.code === 3 ? "No pudimos obtener tu ubicación. Se agotó el tiempo de espera; intentá nuevamente."
          : "No pudimos obtener tu ubicación. Intentá nuevamente desde un lugar con mejor señal.";
      reject(new Error(message));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

export function locationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "No pudimos obtener tu ubicación.";
}

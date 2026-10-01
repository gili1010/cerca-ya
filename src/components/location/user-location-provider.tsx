"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isCoordinates, locationErrorMessage, requestCurrentLocation, type Coordinates } from "@/lib/location";

const storageKey = "cercaya.buyer-location.v1";
interface UserLocationValue {
  coordinates: Coordinates | null;
  loading: boolean;
  error: string;
  useCurrentLocation: () => Promise<void>;
  clearLocation: () => void;
}
const UserLocationContext = createContext<UserLocationValue | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (isCoordinates(stored)) setCoordinates({ latitude: stored.latitude, longitude: stored.longitude });
    } catch { /* Storage may be blocked. In-memory navigation still works. */ }
    return () => { revision.current += 1; };
  }, []);

  const useCurrentLocation = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    const current = ++revision.current;
    setLoading(true); setError("");
    try {
      const point = await requestCurrentLocation();
      if (current !== revision.current) return;
      setCoordinates(point);
      try { sessionStorage.setItem(storageKey, JSON.stringify(point)); } catch { /* Keep the location in memory. */ }
    } catch (cause) {
      if (current === revision.current) setError(locationErrorMessage(cause));
    } finally {
      if (current === revision.current) { pending.current = false; setLoading(false); }
    }
  }, []);

  const clearLocation = useCallback(() => {
    revision.current += 1;
    pending.current = false;
    setCoordinates(null); setLoading(false); setError("");
    try { sessionStorage.removeItem(storageKey); } catch { /* No persistent access in this browser. */ }
  }, []);

  return <UserLocationContext.Provider value={{ coordinates, loading, error, useCurrentLocation, clearLocation }}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation() {
  const context = useContext(UserLocationContext);
  if (!context) throw new Error("useUserLocation requires UserLocationProvider");
  return context;
}

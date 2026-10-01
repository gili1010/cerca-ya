"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isCoordinates, locationErrorMessage, requestCurrentLocation, type Coordinates } from "@/lib/location";
import { resolveLocality } from "@/lib/reverse-geocoding";

const storageKey = "cercaya.buyer-location.v1";
interface UserLocationValue {
  coordinates: Coordinates | null;
  locality: string | null;
  loading: boolean;
  error: string;
  useCurrentLocation: () => Promise<void>;
  clearLocation: () => void;
}
const UserLocationContext = createContext<UserLocationValue | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locality, setLocality] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const pending = useRef(false);
  const cachedLocality = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (isCoordinates(stored)) {
        setCoordinates({ latitude: stored.latitude, longitude: stored.longitude });
        const name = "locality" in stored && typeof stored.locality === "string" ? stored.locality.trim().slice(0, 160) || null : null;
        cachedLocality.current = name;
        setLocality(name);
      }
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
      const name = cachedLocality.current;
      setLocality(name);
      try { sessionStorage.setItem(storageKey, JSON.stringify({ ...point, locality: name })); } catch { /* Keep the location in memory. */ }
      if (!name) {
        const resolved = await resolveLocality(point);
        if (current !== revision.current) return;
        cachedLocality.current = resolved;
        setLocality(resolved);
        try { sessionStorage.setItem(storageKey, JSON.stringify({ ...point, locality: resolved })); } catch { /* Keep the locality in memory. */ }
      }
    } catch (cause) {
      if (current === revision.current) setError(locationErrorMessage(cause));
    } finally {
      if (current === revision.current) { pending.current = false; setLoading(false); }
    }
  }, []);

  const clearLocation = useCallback(() => {
    revision.current += 1;
    pending.current = false;
    cachedLocality.current = null;
    setLocality(null);
    setCoordinates(null); setLoading(false); setError("");
    try { sessionStorage.removeItem(storageKey); } catch { /* No persistent access in this browser. */ }
  }, []);

  return <UserLocationContext.Provider value={{ coordinates, locality, loading, error, useCurrentLocation, clearLocation }}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation() {
  const context = useContext(UserLocationContext);
  if (!context) throw new Error("useUserLocation requires UserLocationProvider");
  return context;
}

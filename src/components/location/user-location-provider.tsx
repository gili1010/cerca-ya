"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { locationErrorMessage, requestCurrentLocation, type Coordinates } from "@/lib/location";
import { resolveLocality } from "@/lib/reverse-geocoding";
import { readBuyerLocation, removeBuyerLocation, saveBuyerLocation } from "@/lib/buyer-location-storage";

interface UserLocationValue {
  coordinates: Coordinates | null;
  locality: string | null;
  updatedAt: number | null;
  loading: boolean;
  error: string;
  useCurrentLocation: () => Promise<void>;
  clearLocation: () => void;
}
const UserLocationContext = createContext<UserLocationValue | null>(null);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locality, setLocality] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    const stored = readBuyerLocation();
    if (stored) {
      setCoordinates({ latitude: stored.latitude, longitude: stored.longitude });
      setLocality(stored.locality);
      setUpdatedAt(stored.updatedAt);
    }
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
      const capturedAt = Date.now();
      setUpdatedAt(capturedAt);
      setLocality(null);
      saveBuyerLocation({ ...point, locality: null, updatedAt: capturedAt });
      const resolved = await resolveLocality(point);
      if (current !== revision.current) return;
      setLocality(resolved);
      saveBuyerLocation({ ...point, locality: resolved, updatedAt: capturedAt });
    } catch (cause) {
      if (current === revision.current) setError(locationErrorMessage(cause));
    } finally {
      if (current === revision.current) { pending.current = false; setLoading(false); }
    }
  }, []);

  const clearLocation = useCallback(() => {
    revision.current += 1;
    pending.current = false;
    setLocality(null);
    setUpdatedAt(null);
    setCoordinates(null); setLoading(false); setError("");
    removeBuyerLocation();
  }, []);

  return <UserLocationContext.Provider value={{ coordinates, locality, updatedAt, loading, error, useCurrentLocation, clearLocation }}>{children}</UserLocationContext.Provider>;
}

export function useUserLocation() {
  const context = useContext(UserLocationContext);
  if (!context) throw new Error("useUserLocation requires UserLocationProvider");
  return context;
}

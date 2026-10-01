"use client";

import { MapPin } from "lucide-react";
import { useUserLocation } from "./user-location-provider";

export function BuyerLocationControls() {
  const { coordinates, locality, loading, error, useCurrentLocation, clearLocation } = useUserLocation();
  return <>
    <p>Usá tu ubicación para ver a qué distancia están los comercios. Se conserva sólo en este navegador durante esta sesión.</p>
    {coordinates && <p role="status">📍 {locality || "Ubicación actual"}</p>}
    <button className="zone-option" disabled={loading} onClick={() => void useCurrentLocation()}><MapPin size={16} />{loading ? "Obteniendo ubicación…" : coordinates ? "Cambiar ubicación" : "Usar mi ubicación"}</button>
    <button className="zone-option" onClick={clearLocation}>No usar mi ubicación</button>
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="info-note">Cambiar ubicación toma nuevamente tu posición actual. Las distancias son aproximadas, en línea recta.</p>
  </>;
}

"use client";

import { MapPin, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { useUserLocation } from "./user-location-provider";

export function BuyerLocationControls() {
  const { coordinates, locality, updatedAt, loading, error, useCurrentLocation: requestCurrentLocation, clearLocation } = useUserLocation();
  const [openedAt] = useState(() => Date.now());
  const olderThanWeek = updatedAt !== null && openedAt - updatedAt > 7 * 24 * 60 * 60 * 1000;
  return <>
    <p>Usamos tu ubicación para mostrarte productos y comercios cercanos. Recordamos tu última ubicación en este navegador hasta que decidas quitarla.</p>
    {coordinates && <p role="status"><MapPin size={16} aria-hidden="true" /> {locality || "Ubicación actual"}</p>}
    {coordinates && olderThanWeek && <p className="location-age-note">Tu ubicación tiene más de 7 días. Podés actualizarla; mientras tanto, seguimos usando la última.</p>}
    <button className="zone-option" disabled={loading} onClick={() => void requestCurrentLocation()}>{coordinates ? <RotateCcw size={16} aria-hidden="true" /> : <MapPin size={16} aria-hidden="true" />}{loading ? "Obteniendo ubicación…" : coordinates ? "Actualizar ubicación" : "Usar mi ubicación"}</button>
    {coordinates && <button className="zone-option" onClick={clearLocation}><X size={16} aria-hidden="true" />Dejar de usar ubicación</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="location-age-note">Las distancias son aproximadas, en línea recta.</p>
  </>;
}

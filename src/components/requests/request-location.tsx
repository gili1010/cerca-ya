"use client";

import { useUserLocation } from "../location/user-location-provider";

export function RequestLocation({ disabled, submittedWithLocation }: {
  disabled: boolean; submittedWithLocation: boolean | null;
}) {
  const { coordinates, locality, loading, error, useCurrentLocation } = useUserLocation();
  return <section className="workflow-form" aria-labelledby="request-location-title">
    <h2 id="request-location-title">¿Dónde lo necesitás?</h2>
    {disabled && submittedWithLocation !== null ? <p role="status">📍 Los reintentos conservan la ubicación elegida al publicar.</p>
      : coordinates ? <p role="status">📍 {locality || "Ubicación actual"}</p>
      : <><p className="info-note">Necesitamos tu ubicación para preguntar a comercios cercanos.</p><button type="button" className="outline-button" disabled={disabled || loading} onClick={() => void useCurrentLocation()}>{loading ? "Obteniendo ubicación…" : "📍 Usar mi ubicación"}</button></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="info-note">La ubicación queda fijada al publicar y se guarda de forma privada. Los comercios reciben sólo la distancia, nunca tus coordenadas.</p>
  </section>;
}

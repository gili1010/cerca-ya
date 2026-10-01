"use client";

import { useRef, useState } from "react";
import { locationErrorMessage, requestCurrentLocation, type Coordinates } from "@/lib/location";

export function BusinessLocationControl({ configured, changed, disabled, onChange, onLoading }: {
  configured: boolean; changed: boolean; disabled: boolean;
  onChange: (coordinates: Coordinates) => void; onLoading: (loading: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  async function capture() {
    if (pending.current || disabled) return;
    pending.current = true; setLoading(true); onLoading(true); setError("");
    try { onChange(await requestCurrentLocation()); }
    catch (cause) { setError(locationErrorMessage(cause)); }
    finally { pending.current = false; setLoading(false); onLoading(false); }
  }
  return <div>
    {configured && !changed && <p>📍 Ubicación configurada</p>}
    <p className="info-note">Usá esta opción solamente si estás físicamente en tu comercio.</p>
    <button type="button" className="outline-button" disabled={disabled || loading} onClick={() => void capture()}>{loading ? "Obteniendo ubicación…" : configured || changed ? "Actualizar ubicación" : "📍 Usar mi ubicación actual"}</button>
    {changed && <p role="status">Ubicación obtenida. Guardá el formulario para confirmarla.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}

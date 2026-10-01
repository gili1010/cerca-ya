"use client";

import { useUserLocation } from "../location/user-location-provider";

export function RequestLocation({ include, onInclude, disabled, submittedWithLocation }: {
  include: boolean; onInclude: (include: boolean) => void; disabled: boolean;
  submittedWithLocation: boolean | null;
}) {
  const { coordinates, loading, error, useCurrentLocation } = useUserLocation();
  // An uncertain submission retains its original consent, even if the shared
  // header location changes while the user is deciding whether to retry.
  if (disabled && submittedWithLocation !== null) return <section className="workflow-form" aria-labelledby="request-location-title">
    <h2 id="request-location-title">¿Dónde lo necesitás?</h2>
    <p role="status">{submittedWithLocation ? "📍 Este intento incluye la ubicación que elegiste al publicar." : "Este intento se publica sin ubicación."}</p>
    <p className="info-note">Los reintentos conservan esta elección. Cambiar la ubicación del catálogo no modifica el pedido enviado.</p>
  </section>;
  return <section className="workflow-form" aria-labelledby="request-location-title">
    <h2 id="request-location-title">¿Dónde lo necesitás?</h2>
    <p className="info-note">Si compartís tu ubicación, CercaYa puede mostrar tu pedido a los comercios que realmente están dentro del radio elegido.</p>
    {coordinates ? <label className="checkbox-label"><input type="checkbox" checked={include} onChange={event => onInclude(event.target.checked)} disabled={disabled} />📍 Usar mi ubicación actual</label>
      : <button type="button" className="outline-button" disabled={disabled || loading} onClick={() => { onInclude(true); void useCurrentLocation(); }}>{loading ? "Obteniendo ubicación…" : "📍 Usar mi ubicación actual"}</button>}
    {loading && !coordinates && <button type="button" className="secondary-link" disabled={disabled} onClick={() => onInclude(false)}>Publicar sin ubicación</button>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <p className="info-note">{include && coordinates ? "Al publicar, esta ubicación se guardará de forma privada en tu pedido. Los comercios reciben sólo la distancia, nunca tus coordenadas. Podés desmarcar la opción." : "Podés publicar sin ubicación. El pedido podrá mostrarse por categoría, sin comprobar el radio ni calcular distancia."}</p>
    <p className="info-note">La ubicación queda fijada al publicar. No mostramos coordenadas en la pantalla ni permitimos cambiarlas en un pedido existente.</p>
  </section>;
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { argentinaProvinces, normalizePlace, provinceByCode } from "@/lib/argentina-provinces";
import { resolveBusinessPlace, resolveCanonicalPlace, searchLocalities, type CanonicalPlace } from "@/lib/reverse-geocoding";
import { isCoordinates, requestCurrentLocation, locationErrorMessage, type Coordinates } from "@/lib/location";
import type { BusinessRow } from "@/types/database";
import type { BusinessInput } from "@/lib/businesses/form";
import { BusinessAddressInput } from "./business-address-input";
import styles from "./business-canonical-location.module.css";

type LocationPatch = Pick<BusinessInput, "city" | "province" | "province_code" | "country_code" | "location_precision"> & { latitude?: number | null; longitude?: number | null; address?: string };
export function BusinessCanonicalLocation({ business, value, disabled, onChange, onLoading, onValidity }: {
  business: BusinessRow | null; value: BusinessInput; disabled: boolean;
  onChange: (patch: LocationPatch) => void; onLoading: (loading: boolean) => void; onValidity: (valid: boolean) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(value.city);
  const [suggestions, setSuggestions] = useState<CanonicalPlace[]>([]);
  const [selected, setSelected] = useState(Boolean(value.province_code && value.city));
  const [searching, setSearching] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const [descriptionPoint, setDescriptionPoint] = useState<(Coordinates & { city: string; provinceCode: string }) | null>(null);
  const [notice, setNotice] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  const bootstrap = useRef<AbortController | null>(null);
  const latest = useRef({ onChange, onLoading, onValidity });
  latest.current = { onChange, onLoading, onValidity };

  useEffect(() => {
    if (!isCoordinates(business)) return;
    const controller = new AbortController(); bootstrap.current = controller;
    const revision = generation.current;
    latest.current.onLoading(true);
    resolveCanonicalPlace(business, controller.signal).then(place => {
      if (controller.signal.aborted || revision !== generation.current) return;
      if (!place) throw new Error("coverage");
      setQuery(place.locality); setSelected(true);
      latest.current.onChange({ city: place.locality, province: place.province, province_code: place.provinceCode, country_code: "AR", location_precision: business?.location_precision ?? "LEGACY" });
      latest.current.onValidity(true);
      setNotice(`Ubicación detectada: ${place.locality}, ${place.province}. Guardá los cambios para confirmarla.`);
    }).catch(() => { if (!controller.signal.aborted && revision === generation.current) setError("No pudimos resolver la localidad en este momento. Conservamos los datos actuales."); })
      .finally(() => { if (!controller.signal.aborted && revision === generation.current) latest.current.onLoading(false); });
    return () => { controller.abort(); generation.current += 1; };
  }, [business]);

  useEffect(() => {
    if (selected || !value.province_code || query.trim().length < 2) return;
    const controller = new AbortController();
    setSearching(true); setError(""); setSuggestions([]); setActive(-1);
    const timer = setTimeout(() => {
      searchLocalities(query, value.province_code!, controller.signal).then(places => {
        if (!controller.signal.aborted) { setSuggestions(places); setOpen(true); }
      }).catch(() => { if (!controller.signal.aborted) setError("No pudimos buscar localidades en este momento."); })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, value.province_code, selected, attempt]);

  function cancelBootstrap() { generation.current += 1; bootstrap.current?.abort(); onLoading(false); }
  function select(place: CanonicalPlace) {
    if (disabled || capturing) return;
    cancelBootstrap(); setQuery(place.locality); setSelected(true); setOpen(false); setSuggestions([]); setError("");
    const samePlace = value.province_code === place.provinceCode && normalizePlace(value.city) === normalizePlace(place.locality);
    if (!samePlace) setDescriptionPoint(null);
    onChange({ city: place.locality, province: place.province, province_code: place.provinceCode, country_code: "AR", ...(samePlace ? {} : { address: "", latitude: null, longitude: null, location_precision: "NONE" as const }) });
    onValidity(true); setNotice("Localidad configurada. Seleccioná una dirección sugerida o usá tu ubicación estando en el comercio. Guardá para confirmar.");
  }
  async function capture() {
    if (disabled || capturing) return;
    setDescriptionPoint(null);
    cancelBootstrap(); const revision = generation.current;
    setCapturing(true); onLoading(true); setError("");
    try {
      const point = await requestCurrentLocation();
      const place = await resolveBusinessPlace(point).catch(() => { throw new Error("No pudimos resolver la localidad en este momento. Conservamos los datos actuales."); });
      if (revision !== generation.current) return;
      if (!place) throw new Error("No pudimos identificar una localidad y provincia de Argentina. Conservamos los datos actuales.");
      onChange({ city: place.locality, province: place.province, province_code: place.provinceCode, country_code: "AR", latitude: point.latitude, longitude: point.longitude, location_precision: "DEVICE", ...(place.address ? { address: place.address } : place.provinceCode !== value.province_code || normalizePlace(place.locality) !== normalizePlace(value.city) ? { address: "" } : {}) });
      setQuery(place.locality); setSelected(true); setOpen(false); setSuggestions([]); onValidity(true);
      setNotice(`✓ Ubicación configurada: ${place.locality}, ${place.province}. Guardá para confirmarla.`);
    } catch (cause) { if (revision === generation.current) setError(locationErrorMessage(cause)); }
    finally { if (revision === generation.current) { setCapturing(false); onLoading(false); } }
  }
  const locked = disabled || capturing;
  const point = { latitude: value.latitude === undefined ? business?.latitude : value.latitude, longitude: value.longitude === undefined ? business?.longitude : value.longitude };
  const configured = isCoordinates(point);
  const context = selected && value.city && value.province && value.province_code ? { locality: value.city, province: value.province, provinceCode: value.province_code, countryCode: "AR" as const } : null;
  return <div className={styles.root}>
    <label htmlFor={`${id}-province`}>Provincia<select id={`${id}-province`} value={value.province_code ?? ""} disabled={locked} onChange={event => {
      setDescriptionPoint(null);
      cancelBootstrap(); const province = provinceByCode(event.target.value);
      onChange({ city: "", address: "", province: province?.name ?? null, province_code: province?.code ?? null, country_code: "AR", latitude: null, longitude: null, location_precision: "NONE" });
      setQuery(""); setSelected(false); setSearching(false); setOpen(false); setSuggestions([]); setNotice(""); setError(""); onValidity(false);
    }}><option value="">Elegí una provincia</option>{argentinaProvinces.map(province => <option key={province.code} value={province.code}>{province.name}</option>)}</select></label>
    <div className={styles.locality}>
      <label htmlFor={`${id}-locality`}>Localidad</label>
      <input id={`${id}-locality`} role="combobox" aria-autocomplete="list" aria-expanded={open && suggestions.length > 0} aria-controls={`${id}-suggestions`} aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-help`} value={query} disabled={locked || !value.province_code} autoComplete="off" maxLength={120} placeholder="Escribí y seleccioná una localidad" onFocus={() => { if (!selected) setOpen(true); }} onChange={event => {
        setDescriptionPoint(null);
        cancelBootstrap(); setQuery(event.target.value); setSelected(false); setOpen(true); setSuggestions([]); setActive(-1); setNotice(""); setError(""); onValidity(false);
        if (event.target.value.trim().length < 2) setSearching(false);
      }} onKeyDown={event => {
        if (event.key === "Escape") { setOpen(false); setActive(-1); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(previous => suggestions.length ? Math.max(0, Math.min(suggestions.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1))) : -1); }
        if (event.key === "Enter" && !selected) { event.preventDefault(); if (open && active >= 0 && suggestions[active]) select(suggestions[active]); }
        if (event.key === "Tab") setOpen(false);
      }} />
      <small id={`${id}-help`}>{!value.province_code ? "Elegí primero la provincia." : selected ? "Localidad seleccionada." : "Seleccioná una sugerencia para guardar la localidad."}</small>
      {open && suggestions.length > 0 && <ul id={`${id}-suggestions`} role="listbox" aria-label="Localidades" className={styles.suggestions}>{suggestions.map((place, index) => <li id={`${id}-option-${index}`} role="option" aria-selected={active === index} key={`${place.provinceCode}:${place.locality}`} onMouseDown={event => event.preventDefault()} onClick={() => select(place)}><strong>{place.locality}</strong><span>{place.province}</span></li>)}</ul>}
      {searching && !selected && query.trim().length >= 2 && <p role="status">Buscando localidades…</p>}
      {open && !selected && !searching && !error && query.trim().length >= 2 && value.province_code && !suggestions.length && <p role="status">No encontramos esa localidad. Probá escribir el nombre nuevamente.</p>}
    </div>
    <BusinessAddressInput value={value.address} context={context} disabled={locked} confirmed={configured} optional={configured && value.location_precision === "DEVICE"} onEdit={address => {
      if (isCoordinates(point) && value.location_precision === "DEVICE" && value.province_code) setDescriptionPoint({ ...point, city: value.city, provinceCode: value.province_code });
      cancelBootstrap(); setNotice("");
      onChange({ city: value.city, province: value.province, province_code: value.province_code, country_code: "AR", address, latitude: null, longitude: null, location_precision: "NONE" });
    }} onSelect={address => {
      setDescriptionPoint(null);
      cancelBootstrap(); setQuery(address.locality); setSelected(true); setOpen(false); setError(""); onValidity(true);
      onChange({ address: address.address, city: address.locality, province: address.province, province_code: address.provinceCode, country_code: "AR", latitude: address.latitude, longitude: address.longitude, location_precision: "ADDRESS" });
      setNotice("Dirección seleccionada. Guardá para confirmar la ubicación del comercio.");
    }} />
    {descriptionPoint && selected && descriptionPoint.provinceCode === value.province_code && normalizePlace(descriptionPoint.city) === normalizePlace(value.city) && <div className={styles.descriptionConfirmation}>
      <p>Si sólo agregaste una descripción de la calle y el comercio sigue en el mismo lugar, podés conservar la ubicación GPS confirmada. Si cambió de lugar, usá una nueva ubicación o seleccioná otra dirección.</p>
      <button type="button" className="outline-button" disabled={locked} onClick={() => {
        onChange({ city: value.city, province: value.province, province_code: value.province_code, country_code: "AR", latitude: descriptionPoint.latitude, longitude: descriptionPoint.longitude, location_precision: "DEVICE" });
        setDescriptionPoint(null); setNotice("Confirmaste que la descripción corresponde al mismo comercio. Conservamos su ubicación GPS.");
      }}>Confirmo que es el mismo lugar: conservar ubicación GPS</button>
    </div>}
    <p className="info-note" role="status">{configured ? <>✓ Ubicación configurada<br />{[value.address, [value.city, value.province].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</> : <>Falta confirmar la ubicación exacta del comercio.<br />Seleccioná una dirección sugerida o usá tu ubicación actual para aparecer en búsquedas por distancia.</>}</p>
    {business && !selected && !value.province_code && <p className="info-note">Localidad actual: {business.city}. Podés conservar tus datos actuales o configurar la ubicación.</p>}
    {notice && <p className="info-note" role="status">{notice}</p>}
    <p className="info-note">La ubicación del comercio y sus distancias son públicas. Dejar la calle vacía no oculta su punto geográfico.</p>
    <p className="info-note">Usá tu ubicación actual solamente si estás físicamente en el comercio. Seleccionar una localidad no establece la ubicación exacta de tu negocio.</p>
    <button type="button" className="outline-button" disabled={locked} onClick={() => void capture()}><MapPin size={17} aria-hidden="true" />{capturing ? "Obteniendo ubicación…" : "Usar mi ubicación actual"}</button>
    {error && <><p className="form-error" role="alert">{error}</p>{!selected && value.province_code && query.trim().length >= 2 && <button type="button" className="secondary-link" disabled={locked} onClick={() => setAttempt(value => value + 1)}>Reintentar búsqueda</button>}</>}
  </div>;
}

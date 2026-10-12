"use client";
import { useEffect, useId, useState } from "react";
import { searchAddresses, type CanonicalAddress, type CanonicalPlace } from "@/lib/reverse-geocoding";
import styles from "./business-canonical-location.module.css";

export function BusinessAddressInput({ value, context, disabled, confirmed, optional = false, onEdit, onSelect }: {
  value: string; context: CanonicalPlace | null; disabled: boolean; confirmed: boolean; optional?: boolean;
  onEdit: (value: string) => void; onSelect: (address: CanonicalAddress) => void;
}) {
  const id = useId();
  const [edited, setEdited] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [attempt, setAttempt] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; addresses: CanonicalAddress[]; error: string } | null>(null);
  const key = JSON.stringify({ value, context });
  const canSearch = !disabled && edited && !confirmed && Boolean(context) && value.trim().length >= 3;
  useEffect(() => {
    if (!canSearch) return;
    const controller = new AbortController();
    const parsed: { value: string; context: CanonicalPlace } = JSON.parse(key);
    const timer = setTimeout(() => {
      searchAddresses(parsed.value, parsed.context, controller.signal).then(addresses => {
        if (!controller.signal.aborted) setSnapshot({ key, addresses, error: "" });
      }).catch(() => {
        if (!controller.signal.aborted) setSnapshot({ key, addresses: [], error: "No pudimos buscar direcciones en este momento." });
      });
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [key, canSearch, attempt]);
  const current = snapshot?.key === key ? snapshot : null;
  const addresses = canSearch ? current?.addresses ?? [] : [];
  const loading = canSearch && !current;
  function choose(address: CanonicalAddress) { if (disabled) return; onSelect(address); setOpen(false); setEdited(false); setActive(-1); }
  return <div className={styles.locality}>
    <label htmlFor={`${id}-address`}>Dirección{optional && <small> · Opcional</small>}</label>
    <input id={`${id}-address`} required={!optional} maxLength={240} disabled={disabled} value={value} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open && addresses.length > 0} aria-controls={`${id}-list`} aria-activedescendant={open && active >= 0 && addresses[active] ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-help`} placeholder="Calle y número del comercio" onFocus={() => setOpen(true)} onChange={event => {
      if (event.target.value !== value) { onEdit(event.target.value); setEdited(true); setOpen(true); setActive(-1); setSnapshot(null); }
    }} onKeyDown={event => {
      if (event.key === "Escape" || event.key === "Tab") { setOpen(false); setActive(-1); }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive(previous => addresses.length ? Math.max(0, Math.min(addresses.length - 1, previous + (event.key === "ArrowDown" ? 1 : -1))) : -1); }
      if (event.key === "Enter" && open && !confirmed) { event.preventDefault(); if (active >= 0 && addresses[active]) choose(addresses[active]); }
    }} />
    <small id={`${id}-help`}>{optional ? "Tu ubicación ya está configurada. No necesitás ingresar una calle." : "Podés guardar una dirección descriptiva. Para ubicar el comercio, seleccioná una sugerencia o usá tu ubicación actual."}</small>
    {open && addresses.length > 0 && <ul id={`${id}-list`} className={styles.suggestions} role="listbox" aria-label="Direcciones sugeridas">{addresses.map((address, index) => <li id={`${id}-option-${index}`} key={address.address} role="option" aria-selected={active === index} onMouseDown={event => event.preventDefault()} onClick={() => choose(address)}><strong>{address.address}</strong><span>{address.locality}, {address.province}</span></li>)}</ul>}
    {loading && <p role="status">Buscando direcciones…</p>}
    {canSearch && !loading && current?.error && <><p className="form-error" role="alert">{current.error}</p><button className="secondary-link" type="button" disabled={disabled} onClick={() => { setSnapshot(null); setAttempt(value => value + 1); }}>Reintentar búsqueda</button></>}
    {canSearch && !loading && current && !current.error && !addresses.length && <p className="info-note" role="status">No pudimos confirmar esa dirección. Podés conservar el texto y usar tu ubicación actual estando en el comercio.</p>}
  </div>;
}

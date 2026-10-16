"use client";

import { useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { argentinaProvinces } from "@/lib/argentina-provinces";
import { searchLocalities } from "@/lib/reverse-geocoding";
import styles from "./personal-listings.module.css";

export function ArticleLocality({ province, city, onProvince, onCity, disabled }: {
  province: string; city: string; onProvince: (value: string) => void; onCity: (value: string) => void; disabled: boolean;
}) {
  const localityListId = useId();
  const [suggestions, setSuggestions] = useState<{ province: string; values: string[] } | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const generation = useRef(0);
  async function search() {
    if (busy || disabled || !province || city.trim().length < 2) return;
    const current = ++generation.current; setBusy(true); setNotice("");
    try {
      const places = await searchLocalities(city, province);
      if (current !== generation.current) return;
      setSuggestions({ province, values: places.map(place => place.locality) });
      setNotice(places.length ? "Elegí una sugerencia en el campo Localidad." : "No encontramos sugerencias. Podés escribir el nombre completo de tu localidad.");
    } catch { if (current === generation.current) setNotice("No pudimos buscar sugerencias. Podés escribir el nombre completo de tu localidad."); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <><div className={styles.fields}><label className={styles.field}>Provincia<select value={province} required disabled={disabled} onChange={event => { generation.current++; setBusy(false); setNotice(""); setSuggestions(null); onProvince(event.target.value); }}><option value="">Elegí una provincia</option>{argentinaProvinces.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label className={styles.field}>Localidad<input value={city} required maxLength={120} disabled={disabled || !province} list={localityListId} autoComplete="off" placeholder="Ej. Alta Gracia" onChange={event => { generation.current++; setBusy(false); setNotice(""); onCity(event.target.value); }} /><datalist id={localityListId}>{suggestions?.province === province && suggestions.values.map(value => <option key={value} value={value} />)}</datalist></label></div>
    <button className="outline-button button-sm" type="button" disabled={disabled || busy || !province || city.trim().length < 2} onClick={() => void search()}><Search size={16} aria-hidden="true" />{busy ? "Buscando…" : "Buscar sugerencias de localidad"}</button>
    {notice && <p className={styles.hint} role="status">{notice}</p>}<p className={styles.hint}>Sólo mostraremos localidad y provincia. No te pedimos GPS ni domicilio.</p></>;
}

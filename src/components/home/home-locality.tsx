"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { ArticleLocality } from "@/components/personal-listings/article-locality";
import { provinceByCode } from "@/lib/argentina-provinces";
import styles from "./home-discovery.module.css";

export function HomeLocality({ locality, provinceCode, hasCoordinates, onLocation, onLocality }: {
  locality: string | null; provinceCode: string | null; hasCoordinates: boolean;
  onLocation: () => void; onLocality: (locality: string, province: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const provinceName = provinceByCode(provinceCode)?.name;
  return <div>
    <div className={styles.location}><MapPin size={17} aria-hidden="true"/><span>{locality && provinceName ? <>Artículos y servicios en <strong>{locality}, {provinceName}</strong></> : "Elegí tu localidad para encontrar opciones cerca."}</span><button type="button" aria-expanded={editing} aria-controls="home-locality-editor" onClick={() => { setCity(locality ?? ""); setProvince(provinceCode ?? ""); setEditing(value => !value); }}>{locality && provinceName ? "Cambiar" : "Elegir localidad"}</button></div>
    {editing && <form id="home-locality-editor" className={styles.localityEditor} onSubmit={event => { event.preventDefault(); if (!city.trim() || !provinceByCode(province)) return; onLocality(city.trim(), province); setEditing(false); }}><p>Elegí dónde buscar artículos y servicios, sin GPS. La búsqueda de comercios conserva su ubicación y distancia actuales.</p><ArticleLocality city={city} province={province} onCity={setCity} onProvince={value => { setProvince(value); setCity(""); }} disabled={false}/><div className={styles.needActions}><button type="submit" className="primary-button" disabled={!city.trim() || !provinceByCode(province)}>Aplicar localidad</button><button type="button" className="outline-button" onClick={() => setEditing(false)}>Cancelar</button></div></form>}
    <button type="button" className={styles.commerceLocation} onClick={onLocation}><MapPin size={14} aria-hidden="true"/>{hasCoordinates ? "Revisar ubicación para comercios" : "Usar ubicación para buscar comercios por distancia"}</button>
  </div>;
}

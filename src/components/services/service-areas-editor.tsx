"use client";
import {useState} from "react";
import {ArticleLocality} from "@/components/personal-listings/article-locality";
import {normalizePlace,provinceByCode} from "@/lib/argentina-provinces";
import type {ServiceAreaInput} from "@/types/services";
import flow from "@/components/publish/publish-flow.module.css";
import styles from "@/components/personal-listings/personal-listings.module.css";
export function ServiceAreasEditor({areas,onChange,disabled}:{areas:ServiceAreaInput[];onChange:(areas:ServiceAreaInput[])=>void;disabled:boolean}){
 const [province,setProvince]=useState(""),[city,setCity]=useState(""),[error,setError]=useState("");
 function add(){
  const locality=city.trim().replace(/\s+/g," ");
  if(!locality||!provinceByCode(province)){setError("Elegí provincia y localidad.");return;}
  if(areas.length>=30){setError("Podés declarar hasta 30 localidades.");return;}
  if(areas.some(area=>area.province_code===province&&normalizePlace(area.city)===normalizePlace(locality))){setError("Esta localidad ya está en tu cobertura.");return;}
  onChange([...areas,{city:locality,province_code:province}]);setCity("");setError("");
 }
 return <><p>Estas localidades se comparten entre todos tus servicios y se utilizan para encontrar trabajos compatibles. Agregá sólo los lugares donde trabajás.</p><ul className={flow.coverage}>{areas.map((area,index)=><li key={`${area.province_code}:${normalizePlace(area.city)}`}>{area.city}, {provinceByCode(area.province_code)?.name} <button type="button" className="secondary-link" disabled={disabled} onClick={()=>onChange(areas.filter((_,i)=>i!==index))} aria-label={`Quitar ${area.city} de la cobertura`}>Quitar</button></li>)}</ul><p className={styles.hint}>{areas.length}/30 localidades. No se muestran distancias.</p><ArticleLocality province={province} city={city} onProvince={value=>{setProvince(value);setCity("");}} onCity={setCity} disabled={disabled}/><button type="button" className="outline-button" disabled={disabled||areas.length>=30||!city.trim()||!province} onClick={add}>Agregar localidad</button>{error&&<p role="alert" className="form-error">{error}</p>}</>;
}


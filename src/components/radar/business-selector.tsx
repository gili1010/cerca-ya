"use client";

import { businesses } from "@/data/businesses";
import { useDemo } from "../demo-provider";

export function BusinessSelector() {
  const { businessId, setBusinessId } = useDemo();
  const business = businesses.find(item => item.id === businessId)!;
  return <div className="business-selector panel"><label htmlFor="radar-business">Comercio de prueba<select id="radar-business" value={businessId} onChange={event => setBusinessId(event.target.value)}>{businesses.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p><strong>Categorías del comercio</strong><br />{business.businessCategories?.join(" · ") || "Sin categorías configuradas"}<br />Identidad y distancias simuladas.</p></div>;
}

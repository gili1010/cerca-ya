"use client";

import { useEffect, useState } from "react";
import { Check, Clock3 } from "lucide-react";

export function StockConfirmation({ date }: { date: string | null }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  if (!date) return <span className="merchant-stock-time unconfirmed"><span className="merchant-stock-label"><Clock3 size={16} aria-hidden="true" />Stock sin confirmar</span></span>;
  const minutes = Math.max(0, Math.floor((now - Date.parse(date)) / 60000));
  const label = minutes < 1 ? "Confirmado recién" : minutes < 60 ? `Confirmado hace ${minutes} min` : minutes < 1440 ? `Confirmado hace ${Math.floor(minutes / 60)} h` : `Confirmado hace ${Math.floor(minutes / 1440)} días`;
  return <time className="merchant-stock-time" dateTime={date} title={new Date(date).toLocaleString("es-AR")}><span className="merchant-stock-label"><Check size={16} aria-hidden="true" />{label}</span><small>Última confirmación: {new Date(date).toLocaleString("es-AR")}</small></time>;
}

"use client";

import { useEffect, useState } from "react";

export function StockTime({ date }: { date: string | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  if (!date) return <span>Stock por confirmar</span>;
  if (now === null) return <time dateTime={date}>Stock confirmado</time>;
  const confirmed = new Date(date);
  const minutes = Math.max(0, Math.floor((now - confirmed.getTime()) / 60000));
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const label = yesterday.toDateString() === confirmed.toDateString() ? "Confirmado ayer" : minutes < 1 ? "Confirmado recién" : minutes < 60 ? `Confirmado hace ${minutes} min` : minutes < 1440 ? `Confirmado hace ${Math.floor(minutes / 60)} h` : `Confirmado el ${confirmed.toLocaleDateString("es-AR")}`;
  return <time dateTime={date} title={confirmed.toLocaleString("es-AR")}>{label}</time>;
}

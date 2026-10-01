"use client";

import { Heart } from "lucide-react";
import { useDemo } from "../demo-provider";

export function SaveProduct({ id }: { id: string }) {
  const { favorites, toggleFavorite } = useDemo();
  const saved = favorites.includes(id);
  return <button className={`detail-save ${saved ? "saved" : ""}`} onClick={() => toggleFavorite(id)} aria-pressed={saved}><Heart size={18} fill={saved ? "currentColor" : "none"} />{saved ? "Guardado" : "Guardar producto"}</button>;
}

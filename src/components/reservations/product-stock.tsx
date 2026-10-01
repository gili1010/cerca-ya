"use client";

import { useProductStock } from "@/lib/request-store";

export function ProductStock({ productId, badge = false }: { productId: string; badge?: boolean }) {
  const { ready, stock } = useProductStock(productId);
  if (badge) return <span className={`stock-pill ${stock <= 2 ? "limited" : ""}`}><span />{!ready ? "Consultando stock" : stock === 0 ? "Sin stock" : stock <= 2 ? "Últimas unidades" : "En stock"}</span>;
  return <span aria-live="polite">{ready ? `${stock} unidades disponibles` : "Consultando stock…"}</span>;
}

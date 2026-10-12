import type { Coordinates } from "./location";

export const catalogRadii = [5, 10, 20, 50] as const;
export type CatalogRadius = typeof catalogRadii[number];
export const defaultRadius: CatalogRadius = 20;
export function catalogRadius(value: number): CatalogRadius {
  return catalogRadii.find(radius => radius === value) ?? defaultRadius;
}
export interface HyperlocalScope {
  buyerLocation?: Coordinates | null;
  locality?: string | null;
  provinceCode?: string | null;
  radiusKm?: CatalogRadius;
}

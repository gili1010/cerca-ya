import type { Product } from "./products";

export function isOnDemand(product: Product): boolean {
  return product.database?.product.inventory_mode === "ON_DEMAND";
}

export function isProductAvailable(product: Product): boolean {
  return isOnDemand(product) ? product.database?.product.available_today === true : product.stock > 0;
}

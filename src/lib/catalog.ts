import { type CategorySelection, type Product, type QuickFilter, type SortOrder } from "./products";

export const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function filterProducts(products: Product[], options: {
  query: string; category: CategorySelection; filters: QuickFilter[];
  favorites: string[]; favoritesOnly: boolean; sort: SortOrder;
}) {
  return products.filter(product => {
    const matches: Record<QuickFilter, boolean> = {
      today: product.deliveryToday || product.pickupToday,
      nearby: product.distanceKm !== null && product.distanceKm < 5,
      delivery: product.deliveryToday,
      pickup: product.pickupToday && product.pickupMinutes !== null && product.pickupMinutes <= 15,
      confirmed: product.confirmedMinutesAgo !== null,
    };
    return (options.category === "Todas" || product.category === options.category)
      && normalize(`${product.name} ${product.store} ${product.category}`).includes(normalize(options.query))
      && (!options.favoritesOnly || options.favorites.includes(product.id))
      && options.filters.every(filter => matches[filter]);
  }).sort((a, b) => options.sort === "price" ? a.price - b.price : options.sort === "distance" ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) : 0);
}

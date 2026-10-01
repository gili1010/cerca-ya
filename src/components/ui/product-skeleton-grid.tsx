/** Decorative placeholders; the existing results line announces loading. */
export function ProductSkeletonGrid() {
  return <div className="product-grid" aria-hidden="true">
    {[0, 1, 2, 3].map(key => <div className="skeleton-card" key={key}>
      <span className="skeleton skeleton-image" />
      <span className="skeleton skeleton-line" />
      <span className="skeleton skeleton-line skeleton-short" />
      <span className="skeleton skeleton-price" />
      <span className="skeleton skeleton-line" />
    </div>)}
  </div>;
}

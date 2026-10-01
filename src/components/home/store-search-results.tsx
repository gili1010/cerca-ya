import { Store } from "lucide-react";
import type { PublicStoreSearchState } from "@/lib/use-public-store-search";
import { storeSearchLimit } from "@/lib/public-store-search";
import { StoreCard } from "./store-card";
import styles from "./store-search.module.css";

export function StoreSearchResults({ stores, loading, error, retry }: PublicStoreSearchState) {
  return <section className={styles.section} aria-labelledby="store-search-title" aria-busy={loading}>
    <div className={styles.heading}><h3 id="store-search-title"><Store size={19} aria-hidden="true" />Tiendas</h3>
      {!loading && !error && stores.length > 0 && <span>{stores.length} {stores.length === 1 ? "tienda" : "tiendas"}</span>}
    </div>
    {loading && <p className={styles.notice} role="status">Buscando tiendas cerca tuyo...</p>}
    {error && <div className={styles.notice}><p role="alert">{error}</p><button className="secondary-link" onClick={retry}>Reintentar tiendas</button></div>}
    {!loading && !error && stores.length === 0 && <p className={styles.notice}>No encontramos tiendas con esta búsqueda.</p>}
    {!loading && !error && stores.length > 0 && <div className={styles.grid}>{stores.map(store => <StoreCard key={store.id} store={store} />)}</div>}
    {!loading && !error && stores.length === storeSearchLimit && <p className={styles.limit}>Mostramos hasta {storeSearchLimit} tiendas. Afiná la búsqueda para encontrar otra.</p>}
  </section>;
}

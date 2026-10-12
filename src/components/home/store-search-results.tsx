import { Store } from "lucide-react";
import type { PublicStoreSearchState } from "@/lib/use-public-store-search";
import { storeSearchLimit } from "@/lib/public-store-search";
import { StoreCard } from "./store-card";
import styles from "./store-search.module.css";
import localityStyles from "./catalog-locality.module.css";

interface StoreSearchResultsProps extends PublicStoreSearchState {
  title?: string;
  description?: string;
  id?: string;
  localityMatch?: boolean;
}

export function StoreSearchResults({ stores, loading, error, retry, title = "Tiendas", description, id = "store-search-title", localityMatch = false }: StoreSearchResultsProps) {
  return <section className={styles.section} aria-labelledby={id} aria-busy={loading}>
    <div className={`${styles.heading} ${localityStyles.storeHeading}`}><h3 id={id}><Store size={19} aria-hidden="true" />{title}</h3>
      {!loading && !error && stores.length > 0 && <span>{stores.length} {stores.length === 1 ? "tienda" : "tiendas"}</span>}
    </div>
    {description && <p className={localityStyles.storeDescription}>{description}</p>}
    {loading && <p className={styles.notice} role="status">{localityMatch ? "Buscando tiendas en tu localidad..." : "Buscando tiendas cerca tuyo..."}</p>}
    {error && <div className={styles.notice}><p role="alert">{error}</p><button className="secondary-link" onClick={retry}>Reintentar tiendas</button></div>}
    {!loading && !error && stores.length === 0 && <p className={styles.notice}>No encontramos tiendas con esta búsqueda.</p>}
    {!loading && !error && stores.length > 0 && <div className={styles.grid}>{stores.map(store => <StoreCard key={store.id} store={store} localityMatch={localityMatch} />)}</div>}
    {!loading && !error && stores.length === storeSearchLimit && <p className={styles.limit}>Mostramos hasta {storeSearchLimit} tiendas. Afiná la búsqueda para encontrar otra.</p>}
  </section>;
}

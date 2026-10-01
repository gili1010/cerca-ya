"use client";
import { useEffect, useState } from "react";
import { useDemo } from "../demo-provider";
import { ProductList } from "../details/product-list";
import { usePublicCatalog } from "@/lib/use-public-catalog";
import { publicPageSize } from "@/lib/public-catalog";

export function SavedProducts() {
  const { favorites } = useDemo();
  const [page, setPage] = useState(0);
  const key = favorites.join(",");
  useEffect(() => { setPage(0); }, [key]);
  const catalog = usePublicCatalog({ query: "", category: "", filters: [], sort: "recommended", page, favoriteIds: favorites });
  return <><div className="workflow-heading"><h1>Guardados</h1><p>Se conservan durante esta visita. Todavía no se guardan en Supabase.</p></div>
    {catalog.loading ? <p role="status">Cargando productos...</p> : catalog.error ? <div className="empty-state"><p role="alert">{catalog.error}</p><button className="primary-button" onClick={catalog.retry}>Reintentar</button></div> : catalog.total === 0 ? <div className="empty-state"><h2>No tenés productos disponibles guardados.</h2><p>Los productos inactivos no aparecen aquí.</p></div> : <ProductList products={catalog.products} />}
    {!catalog.loading && !catalog.error && catalog.total > publicPageSize && <nav className="merchant-product-pagination" aria-label="Guardados"><button disabled={page === 0} onClick={() => setPage(value => value - 1)}>Anterior</button><span>{page + 1} / {Math.ceil(catalog.total / publicPageSize)}</span><button disabled={(page + 1) * publicPageSize >= catalog.total} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav>}
  </>;
}

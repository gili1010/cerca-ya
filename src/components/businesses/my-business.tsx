"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BusinessRow } from "@/types/database";
import { money } from "@/lib/products";
import { formatArgentinaPhone } from "@/lib/phone";
import { getBusinessFormData } from "@/lib/businesses/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError } from "../requests/request-common";
import { useMyBusiness } from "./business-provider";
import { MerchantStoreCard } from "../stores/merchant-store-card";
import { StoreBrandingEditor } from "../stores/store-branding-editor";

export function MyBusiness() {
  const { business, loading, error, refresh } = useMyBusiness();
  const router = useRouter();
  useEffect(() => { if (!loading && !error && !business) router.replace("/comercio/crear"); }, [loading, error, business, router]);
  if (loading) return <p className="workflow-loading" role="status">Cargando tu comercio…</p>;
  if (error) return <section className="panel"><FormError message={error} /><button className="outline-button" onClick={() => void refresh().catch(() => {})}>Reintentar</button></section>;
  if (!business) return <p role="status">Abriendo el formulario de creación…</p>;
  return <><BusinessDetails key={`${business.id}-${business.updated_at}`} business={business} /><div className="workflow-narrow"><MerchantStoreCard business={business} /><StoreBrandingEditor key={business.id} business={business} /></div></>;
}

function BusinessDetails({ business }: { business: BusinessRow }) {
  const [categories, setCategories] = useState<string[] | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos cargar las categorías."); return; }
    getBusinessFormData(client, business.id).then(result => {
      if (live) { setCategories(result.categories.filter(category => result.categoryIds.includes(category.id)).map(category => category.name)); setError(""); }
    }).catch(() => { if (live) setError("No pudimos cargar las categorías."); });
    return () => { live = false; };
  }, [business.id, attempt]);
  return <div className="workflow-narrow"><div className="workflow-heading"><span className="eyebrow">MI COMERCIO</span><h1>{business.name}</h1><p>{business.city}</p></div><section className="panel">
    <p className="request-description">{business.description || "Sin descripción."}</p>
    <dl className="request-facts"><div><dt>WhatsApp</dt><dd>{formatArgentinaPhone(business.whatsapp)}</dd></div><div><dt>Dirección</dt><dd>{business.address}</dd></div><div><dt>Retiro</dt><dd>{business.pickup_enabled ? "Disponible" : "No disponible"}</dd></div><div><dt>Envío</dt><dd>{business.delivery_enabled ? `Hasta ${business.delivery_radius_km} km` : "No disponible"}</dd></div><div><dt>Costo de envío</dt><dd>{business.delivery_enabled ? business.delivery_price === 0 ? "Gratis" : money(business.delivery_price) : "No aplica"}</dd></div><div><dt>Compra mínima</dt><dd>{business.minimum_order ? money(business.minimum_order) : "Sin mínimo"}</dd></div><div><dt>Identificador</dt><dd>{business.slug}</dd></div><div><dt>Estado</dt><dd>{business.active ? "Activo" : "Inactivo"} · {business.verified ? "Verificado" : "Sin verificar"}</dd></div></dl>
    <h2>Categorías</h2><FormError message={error} />{error ? <button className="outline-button" onClick={() => setAttempt(value => value + 1)}>Reintentar categorías</button> : categories === null ? <p role="status">Cargando categorías…</p> : <p className="request-description">{categories.join(" · ") || "Sin categorías asignadas"}</p>}
    <div className="offer-detail-actions"><Link className="primary-button" href="/comercio/editar">Editar comercio</Link><Link className="outline-button" href="/comercio/productos">Mis productos</Link><Link className="outline-button" href="/comercio">Ir al panel</Link></div>
    <p className="info-note">Tu comercio y productos se guardan en tu cuenta y alimentan el catálogo público. Radar, pedidos, ofertas y reservas siguen siendo de prueba.</p>
  </section></div>;
}

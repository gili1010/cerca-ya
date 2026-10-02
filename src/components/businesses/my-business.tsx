"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Check, Clock, LayoutDashboard, MapPin, Package, Pencil, Phone, ShieldCheck, ShoppingBag, Store, Tags, Truck, type LucideIcon } from "lucide-react";
import type { BusinessRow } from "@/types/database";
import { money } from "@/lib/products";
import { formatArgentinaPhone } from "@/lib/phone";
import { getBusinessFormData } from "@/lib/businesses/client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError } from "../requests/request-common";
import { useMyBusiness } from "./business-provider";
import { MerchantStoreCard } from "../stores/merchant-store-card";
import { StoreBrandingEditor } from "../stores/store-branding-editor";
import storeStyles from "../stores/merchant-store.module.css";
import styles from "./business-details.module.css";

export function MyBusiness() {
  const { business, loading, error, refresh } = useMyBusiness();
  const router = useRouter();
  useEffect(() => { if (!loading && !error && !business) router.replace("/comercio/crear"); }, [loading, error, business, router]);
  if (loading) return <p className="workflow-loading" role="status">Cargando tu comercio…</p>;
  if (error) return <section className="panel"><FormError message={error} /><button className="outline-button" onClick={() => void refresh().catch(() => {})}>Reintentar</button></section>;
  if (!business) return <p role="status">Abriendo el formulario de creación…</p>;
  return <><BusinessDetails key={`${business.id}-${business.updated_at}`} business={business} /><div className={storeStyles.workspace}><MerchantStoreCard business={business} /><StoreBrandingEditor key={business.id} business={business} /></div></>;
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
  return <div className={storeStyles.workspace}>
    <section className={styles.detailsCard} aria-label="Datos del comercio">
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.storeIcon}><Store size={28} aria-hidden="true" /></span>
          <div className={styles.nameBlock}>
            <span className={`eyebrow ${styles.label}`}>MI COMERCIO</span>
            <h1>{business.name}</h1>
            {business.city && <p className={styles.city}><MapPin size={16} aria-hidden="true" />{business.city}</p>}
          </div>
        </div>
        <div className={styles.badges} aria-label="Estado del comercio">
          <span className={`${styles.badge} ${business.active ? styles.positive : styles.neutral}`}>
            {business.active && <Check size={14} aria-hidden="true" />}{business.active ? "Activo" : "Inactivo"}
          </span>
          <span className={`${styles.badge} ${business.verified ? styles.positive : styles.neutral}`}>
            {business.verified ? <ShieldCheck size={14} aria-hidden="true" /> : <Clock size={14} aria-hidden="true" />}{business.verified ? "Verificado" : "Sin verificar"}
          </span>
        </div>
        {business.description.trim() && <p className={styles.description}>{business.description}</p>}
      </header>
      <div className={styles.body}>
        <h2 className={styles.title}>Datos del comercio</h2>
        <div className={styles.groups}>
          <section className={styles.group} aria-labelledby="business-contact-title">
            <h3 id="business-contact-title">Contacto</h3>
            <dl className={styles.facts}>
              <BusinessFact icon={Phone} label="WhatsApp" value={formatArgentinaPhone(business.whatsapp)} />
              <BusinessFact icon={MapPin} label="Dirección" value={business.address || "Sin informar"} />
            </dl>
          </section>
          <section className={styles.group} aria-labelledby="business-delivery-title">
            <h3 id="business-delivery-title">Entrega</h3>
            <dl className={`${styles.facts} ${styles.deliveryFacts}`}>
              <BusinessFact icon={Package} label="Retiro" value={business.pickup_enabled ? "Disponible" : "No disponible"} />
              <BusinessFact icon={Truck} label="Envío" value={business.delivery_enabled ? `Hasta ${business.delivery_radius_km} km` : "No disponible"} />
              <BusinessFact icon={Banknote} label="Costo de envío" value={business.delivery_enabled ? business.delivery_price === 0 ? "Gratis" : money(business.delivery_price) : "No aplica"} />
              <BusinessFact icon={ShoppingBag} label="Compra mínima" value={business.minimum_order ? money(business.minimum_order) : "Sin mínimo"} />
            </dl>
          </section>
        </div>
        <section className={styles.categories} aria-labelledby="business-categories-title">
          <h3 id="business-categories-title"><Tags size={18} aria-hidden="true" />Categorías</h3>
          <FormError message={error} />
          {error ? <button className="outline-button" onClick={() => setAttempt(value => value + 1)}>Reintentar categorías</button>
            : categories === null ? <p className={styles.categoryNote} role="status">Cargando categorías…</p>
            : categories.length ? <ul className={styles.categoryList}>{categories.map((category, index) => <li key={`${category}-${index}`}>{category}</li>)}</ul>
            : <p className={styles.categoryNote}>Sin categorías asignadas</p>}
        </section>
      </div>
      <footer className={styles.actions}>
        <Link className="primary-button" href="/comercio/editar"><Pencil size={17} aria-hidden="true" />Editar comercio</Link>
        <div className={styles.secondaryActions}>
          <Link className="outline-button" href="/comercio/productos"><ShoppingBag size={17} aria-hidden="true" />Mis productos</Link>
          <Link className="outline-button" href="/comercio"><LayoutDashboard size={17} aria-hidden="true" />Ir al panel</Link>
        </div>
      </footer>
    </section>
  </div>;
}

function BusinessFact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className={styles.fact}><dt><Icon size={17} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>;
}

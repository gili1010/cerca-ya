"use client";
import { BackLink } from "@/components/navigation/back-link";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { BusinessRow, CategoryRow } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBusinessFormData } from "@/lib/businesses/client";
import { businessErrorMessage, deliveryRadii, emptyBusiness, normalizeBusiness, validateBusiness, type BusinessInput } from "@/lib/businesses/form";
import { ensureProfile } from "@/lib/auth/profile";
import { useAuth } from "../auth/auth-provider";
import { FormError } from "../requests/request-common";
import { useMyBusiness } from "./business-provider";
import { BusinessLocationControl } from "./business-location-control";
import { isCoordinates } from "@/lib/location";
import { BusinessHoursEditor } from "./business-hours-editor";
import styles from "./business-edit.module.css";

export function BusinessForm({ edit = false }: { edit?: boolean }) {
  const { business, loading, error, refresh } = useMyBusiness();
  const router = useRouter();
  const [locationSaved, setLocationSaved] = useState(false);
  useEffect(() => {
    if (!locationSaved && !loading && !error && (edit ? !business : business)) router.replace(edit ? "/comercio/crear" : "/comercio/mi-negocio");
  }, [loading, error, business, edit, router, locationSaved]);
  if (locationSaved) return <section className="panel workflow-narrow"><h1 role="status">✅ Ubicación guardada</h1><p>Los datos de tu comercio se guardaron correctamente.</p><BackLink href="/comercio/mi-negocio">Volver a Mi comercio</BackLink></section>;
  if (loading) return <p className="workflow-loading" role="status">Cargando tu comercio…</p>;
  if (error) return <section className="panel"><FormError message={error} /><button className="outline-button" onClick={() => void refresh().catch(() => {})}>Reintentar</button></section>;
  if (edit ? !business : business) return <p className="workflow-loading" role="status">{business ? "Ya tenés un comercio registrado. Abriendo Mi comercio…" : "Abriendo el formulario de creación…"}</p>;
  return <BusinessFormFields key={business?.id ?? "new"} business={business} onLocationSaved={() => setLocationSaved(true)} />;
}

function BusinessFormFields({ business, onLocationSaved }: { business: BusinessRow | null; onLocationSaved: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useMyBusiness();
  const [form, setForm] = useState<BusinessInput>(() => business ? {
    name: business.name, description: business.description, whatsapp: business.whatsapp ?? "", city: business.city ?? "", address: business.address ?? "",
    pickup_enabled: business.pickup_enabled, delivery_enabled: business.delivery_enabled,
    delivery_radius_km: business.delivery_radius_km || 5, delivery_price: business.delivery_price, minimum_order: business.minimum_order,
    accepts_cash: business.accepts_cash ?? true, accepts_transfer: business.accepts_transfer ?? false, transfer_alias: business.transfer_alias ?? "",
    instagram_url: business.instagram_url ?? "", facebook_url: business.facebook_url ?? "",
  } : { ...emptyBusiness });
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [merchantAccepted, setMerchantAccepted] = useState(false);
  const [locating, setLocating] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setLoadError("No pudimos conectar con el catálogo de categorías."); return; }
    getBusinessFormData(client, business?.id).then(data => {
      if (!live) return;
      setCategories(data.categories); setSelected(data.categoryIds); setReady(true); setLoadError("");
    }).catch(() => { if (live) setLoadError("No pudimos cargar las categorías. Intentá nuevamente."); });
    return () => { live = false; };
  }, [business?.id, attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !ready || locating) return;
    if (!business && !merchantAccepted) { setError("Aceptá las Reglas para Comercios antes de crear tu comercio."); return; }
    const validation = validateBusiness(form, selected);
    if (validation) { setError(validation); return; }
    if (!user) { router.replace("/login?redirect=" + encodeURIComponent(business ? "/comercio/editar" : "/comercio/crear")); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      await ensureProfile(client, user);
      if (!business) {
        const { error: acceptanceError } = await client.rpc("accept_my_legal_terms", { p_accept: true, p_merchant: true });
        if (acceptanceError) { setError("No pudimos guardar tu aceptación. Volvé a intentar."); inFlight.current = false; setBusy(false); return; }
      }
      const { error: failure } = await client.rpc("save_my_business_with_social_links", {
        p_input: normalizeBusiness(form), p_category_ids: selected, p_business_id: business?.id ?? null,
      });
      if (failure) throw failure;
      if (form.latitude !== undefined) onLocationSaved();
      // A saved transaction remains successful even if the subsequent read fails.
      await refresh().catch(() => null);
      if (form.latitude !== undefined) return;
      router.replace("/comercio/mi-negocio");
      router.refresh();
    } catch (cause) { setError(businessErrorMessage(cause, Boolean(business))); inFlight.current = false; setBusy(false); }
  }

  return <div className={`workflow-narrow${business ? ` ${styles.edit}` : ""}`}><BackLink href={business ? "/comercio/mi-negocio" : "/cuenta"}>Volver</BackLink><div className="workflow-heading"><h1>{business ? "Editar comercio" : "Crear mi comercio"}</h1><p>Contanos qué vendés y cómo pueden comprar cerca tuyo.</p></div>
    <form className="panel workflow-form" onSubmit={submit}>
      <EditFormGroup enabled={Boolean(business)} title="Información del comercio">
      <label>Nombre del comercio<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} required maxLength={160} autoComplete="organization" disabled={busy} /></label>
      {business && <p className={`info-note ${styles.permanent}`}><Link2 size={16} aria-hidden="true" /><span>Tu enlace permanente: /tienda/{business.slug}. Se conserva aunque cambies el nombre, la localidad u otros datos del comercio.</span></p>}
      <label>Descripción<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={3000} disabled={busy} /></label>
      </EditFormGroup>
      <EditFormGroup enabled={Boolean(business)}>
      <fieldset className="workflow-form" disabled={busy}>
        <legend>Redes sociales</legend>
        <p className="info-note">Opcional. Agregá tus redes para que los clientes puedan conocer más sobre tu negocio.</p>
        <div className="form-columns">
          <label>Instagram<input value={form.instagram_url} onChange={event => setForm({ ...form, instagram_url: event.target.value })} maxLength={300} placeholder="@mitienda o instagram.com/mitienda" autoCapitalize="none" spellCheck={false} /><small>Podés ingresar tu usuario o el enlace de tu perfil.</small></label>
          <label>Facebook<input value={form.facebook_url} onChange={event => setForm({ ...form, facebook_url: event.target.value })} maxLength={300} placeholder="mitienda o facebook.com/mitienda" autoCapitalize="none" spellCheck={false} /><small>Dejá el campo vacío para quitar una red existente.</small></label>
        </div>
      </fieldset>
      <label>WhatsApp · Argentina (+54)<input type="tel" value={form.whatsapp} onChange={event => setForm({ ...form, whatsapp: event.target.value })} required maxLength={40} autoComplete="tel" placeholder="Código de área + número" disabled={busy} /><small>Ingresá código de área y número, sin 0 ni 15. Agregamos +54 y el 9 para WhatsApp automáticamente. Si ya escribiste +54 9, no lo duplicamos.</small></label>
      </EditFormGroup>
      <section className={`workflow-form${business ? ` ${styles.section}` : ""}`} aria-labelledby="business-location-title">
        <h2 id="business-location-title">Ubicación del comercio</h2>
        <label>Dirección<input value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} required maxLength={240} autoComplete="street-address" disabled={busy} /></label>
        <label>Ciudad / localidad<input value={form.city} onChange={event => setForm({ ...form, city: event.target.value })} required maxLength={120} autoComplete="address-level2" disabled={busy} /></label>
        <EditFormGroup enabled={Boolean(business)} location><BusinessLocationControl configured={isCoordinates(business)} changed={form.latitude !== undefined} disabled={busy} onLoading={setLocating} onChange={coordinates => setForm(current => ({ ...current, ...coordinates }))} /></EditFormGroup>
      </section>
      <EditFormGroup enabled={Boolean(business)}>
      <fieldset className="form-checkboxes" disabled={busy || !ready}><legend>Categorías que vende tu comercio · elegí al menos una</legend>{categories.map(category => <label key={category.id}><input type="checkbox" checked={selected.includes(category.id)} onChange={event => setSelected(current => event.target.checked ? [...current, category.id] : current.filter(id => id !== category.id))} />{category.name}</label>)}</fieldset>
      {!ready && !loadError && <p role="status">Cargando categorías…</p>}<FormError message={loadError} />{loadError && <button type="button" className="outline-button" onClick={() => { setLoadError(""); setAttempt(value => value + 1); }}>Reintentar categorías</button>}
      {ready && !categories.length && <p className="form-error">No hay categorías disponibles. No se puede crear un comercio hasta que se carguen.</p>}
      </EditFormGroup>
      <EditFormGroup enabled={Boolean(business)} title="Entrega">
      <fieldset id="business-delivery" className="form-checkboxes" disabled={busy}><legend>Retiro y envío</legend><label><input type="checkbox" checked={form.pickup_enabled} onChange={event => setForm({ ...form, pickup_enabled: event.target.checked })} />Permite retiro</label><label><input type="checkbox" checked={form.delivery_enabled} onChange={event => setForm({ ...form, delivery_enabled: event.target.checked })} />Realiza envíos</label></fieldset>
      {form.delivery_enabled && <div className={`form-columns${business ? ` ${styles.deliveryFields}` : ""}`}><label>{business ? <span>Radio de entrega</span> : "Radio de entrega"}<select value={form.delivery_radius_km} onChange={event => setForm({ ...form, delivery_radius_km: Number(event.target.value) })} disabled={busy}>{deliveryRadii.map(radius => <option key={radius} value={radius}>{radius} km</option>)}</select></label><label>{business ? <span>Costo de envío (ARS)</span> : "Costo de envío (ARS)"}<input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={form.delivery_price} onChange={event => setForm({ ...form, delivery_price: Number(event.target.value) })} required disabled={busy} /><small>0 significa envío gratis.</small></label></div>}
      <label>Compra mínima (ARS)<input type="number" min="0" max="9999999999.99" step="0.01" inputMode="decimal" value={form.minimum_order || ""} onChange={event => setForm({ ...form, minimum_order: Number(event.target.value) })} placeholder="Sin compra mínima" disabled={busy} /><small>Opcional. Dejá vacío o ingresá 0 si no hay mínimo.</small></label>
      </EditFormGroup>
      <EditFormGroup enabled={Boolean(business)}>
      <fieldset id="business-payment" className="form-checkboxes" disabled={busy}><legend>Medios de pago</legend><label><input type="checkbox" checked={form.accepts_cash} onChange={event => setForm({ ...form, accepts_cash: event.target.checked })} />Acepto efectivo</label><label><input type="checkbox" checked={form.accepts_transfer} onChange={event => setForm({ ...form, accepts_transfer: event.target.checked })} />Acepto transferencia</label></fieldset>
      {form.accepts_transfer && <label>Alias para transferencias<input value={form.transfer_alias} onChange={event => setForm({ ...form, transfer_alias: event.target.value })} maxLength={100} placeholder="Opcional" disabled={busy} autoCapitalize="none" spellCheck={false} /><small>Se incluirá en las nuevas reservas con transferencia. CercaYa no procesa ni verifica pagos.</small></label>}
      <p className="info-note">Tus clientes también pueden elegir coordinar el pago con vos.</p>
      </EditFormGroup>
      {!business && <label className="checkbox-label"><input type="checkbox" required checked={merchantAccepted} onChange={event => setMerchantAccepted(event.target.checked)} disabled={busy} /><span>Declaro que la información de mi comercio es verdadera y acepto las <Link href="/reglas-comercios" target="_blank" rel="noopener noreferrer">Reglas para Comercios</Link>.</span></label>}
      {business && <BusinessHoursEditor businessId={business.id} disabled={busy || locating} />}
      <EditFormGroup enabled={Boolean(business)} footer><FormError message={error} /><button className="primary-button" type="submit" disabled={busy || locating || !ready || !categories.length}>{busy ? business ? "Guardando cambios…" : "Creando comercio…" : business ? "Guardar cambios" : "Crear comercio"}</button></EditFormGroup>
    </form></div>;
}

// Presentation wrappers disappear entirely from the create-business form.
function EditFormGroup({ enabled, title, children, location = false, footer = false }: {
  enabled: boolean; title?: string; children: ReactNode; location?: boolean; footer?: boolean;
}) {
  if (!enabled) return <>{children}</>;
  if (location || footer) return <div className={location ? styles.location : styles.footer}>{children}</div>;
  return <section className={styles.section}>{title && <h2>{title}</h2>}{children}</section>;
}

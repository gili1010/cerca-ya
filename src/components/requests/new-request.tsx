"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isCoordinates } from "@/lib/location";
import { Megaphone } from "lucide-react";
import type { CategoryRow, Database, DatabaseNeededWhen } from "@/types/database";
import { requestRadii, requestUrgencies, validateBuyerRequest, type BuyerRequestInput } from "@/lib/buyer-requests";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicCategories } from "@/lib/public-catalog";
import { ensureProfile } from "@/lib/auth/profile";
import { loginUrl } from "@/lib/auth/redirect";
import { useAuth } from "../auth/auth-provider";
import { FormError } from "./request-common";
import flow from "@/components/publish/publish-flow.module.css";
import { BackLink } from "@/components/navigation/back-link";
import { RequestLocation } from "./request-location";
import { useUserLocation } from "../location/user-location-provider";

export function NewRequest({ initialTitle }: { initialTitle: string }) {
  const { user } = useAuth();
  return user ? <NewRequestFields key={user.id} initialTitle={initialTitle} /> : <p role="status">Comprobando tu sesión...</p>;
}

function NewRequestFields({ initialTitle }: { initialTitle: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { coordinates, loading: locating } = useUserLocation();
  const [form, setForm] = useState<BuyerRequestInput>({ title: (initialTitle ? (/^busco\s/i.test(initialTitle) ? initialTitle : `Busco ${initialTitle}`) : "").slice(0, 120), description: "", category_id: "", needed_when: "TODAY", radius_km: 20 });
  const [categories, setCategories] = useState<CategoryRow[] | null>(null);
  const [categoryError, setCategoryError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [submittedWithLocation, setSubmittedWithLocation] = useState<boolean | null>(null);
  const locked = submitting || uncertain;
  const inFlight = useRef(false);
  const submission = useRef<Database["public"]["Functions"]["create_my_request"]["Args"] | null>(null);
  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setCategoryError("No pudimos cargar las categorías."); return; }
    getPublicCategories(client).then(data => { if (live) { setCategories(data); setCategoryError(""); } })
      .catch(() => { if (live) setCategoryError("No pudimos cargar las categorías."); });
    return () => { live = false; };
  }, [attempt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || !categories || (!uncertain && locating)) return;
    if (!uncertain && !isCoordinates(coordinates)) { setError("Necesitamos tu ubicación para preguntar a comercios cercanos."); return; }
    const validation = validateBuyerRequest(form, categories);
    if (validation) { setError(validation); return; }
    if (!user) { router.replace(loginUrl(`/pedido/nuevo?q=${encodeURIComponent(form.title)}`)); return; }
    inFlight.current = true; setSubmitting(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      await ensureProfile(client, user);
      // Freeze consent and coordinates with the idempotency key. A lost response
      // must not turn a retry into a request with different privacy choices.
      submission.current ??= {
        p_request_id: crypto.randomUUID(), p_title: form.title.trim(), p_description: form.description.trim(),
        p_category_id: form.category_id, p_radius_km: form.radius_km, p_needed_when: form.needed_when,
        p_latitude: coordinates?.latitude ?? null,
        p_longitude: coordinates?.longitude ?? null,
      };
      setSubmittedWithLocation(submission.current.p_latitude != null && submission.current.p_longitude != null);
      const { data: id, error: failure } = await client.rpc("create_my_request", submission.current);
      if (failure) {
        // PostgreSQL validation/permission errors and PostgREST schema errors
        // are definitive failures; transport errors may follow a committed write.
        if (/^(22|23|42|P0|PGRST)/.test(failure.code)) submission.current = null;
        throw failure;
      }
      router.replace(`/pedido/${id}/confirmacion`);
    } catch (cause) {
      const pending = submission.current !== null;
      setUncertain(pending);
      const suspended = typeof cause === "object" && cause !== null && "message" in cause && String(cause.message).includes("account_suspended");
      const locationRequired = typeof cause === "object" && cause !== null && "message" in cause && String(cause.message).includes("request_location");
      setError(locationRequired ? "Necesitamos tu ubicación para preguntar a comercios cercanos." : suspended ? "Tu cuenta está suspendida." : pending ? "No pudimos confirmar si se publicó. Reintentá con los mismos datos y la misma ubicación, o revisá Mis pedidos." : "No pudimos publicar tu pedido. Volvé a intentar.");
      inFlight.current = false; setSubmitting(false);
    }
  }

  return <div className={`workflow-narrow ${flow.flow}`}><BackLink href="/publicar">Opciones para publicar</BackLink><div className="workflow-heading"><span className="eyebrow"><Megaphone size={15} aria-hidden="true" />PEDIDO ABIERTO</span><h1>¿Qué producto necesitás?</h1><p>Contanos qué buscás para que los comercios cercanos puedan encontrar tu pedido.</p></div>
    <p className={flow.status}>Completá este formulario y publicá tu pedido. No es una publicación de venta ni una compra automática.</p>
    <form className="workflow-form panel" onSubmit={submit} aria-busy={submitting} aria-describedby={error?"product-request-feedback":undefined}>
      <h2>1. Qué estás buscando</h2><label htmlFor="request-title">¿Qué estás buscando?<input id="request-title" aria-describedby={error?"product-request-feedback":undefined} name="title" required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sensor de cigüeñal Ford Ka 2019" disabled={locked} /></label>
      <label htmlFor="request-description">Descripción <small>Opcional</small><textarea id="request-description" name="description" maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Motor 1.5, necesito retirarlo hoy si es posible." disabled={locked} /></label>
      <label htmlFor="request-category">Categoría<select id="request-category" required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} disabled={locked || !categories?.length}><option value="">Elegí una categoría</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      {!categories && !categoryError && <p role="status">Cargando categorías...</p>}
      <FormError message={categoryError} />{categoryError && <button type="button" className="outline-button" onClick={() => { setCategoryError(""); setAttempt(value => value + 1); }}>Reintentar categorías</button>}
      {categories?.length === 0 && <p className="info-note">No hay categorías disponibles. Cargalas antes de publicar pedidos.</p>}
      <h2>2. Dónde y hasta cuándo buscar</h2><RequestLocation disabled={locked} submittedWithLocation={submittedWithLocation} />
      <label htmlFor="request-urgency">¿Cuándo lo necesitás?<select id="request-urgency" value={form.needed_when} onChange={e => setForm({ ...form, needed_when: e.target.value as DatabaseNeededWhen })} disabled={locked}>{Object.entries(requestUrgencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="request-radius">¿Hasta qué distancia querés buscar?<select id="request-radius" value={form.radius_km} onChange={e => setForm({ ...form, radius_km: Number(e.target.value) })} disabled={locked}>{requestRadii.map(value => <option key={value} value={value}>{value} km</option>)}</select><small>Sólo los comercios dentro del radio podrán encontrar tu pedido.</small></label>
      <p data-publish-help>Por ahora este pedido se publica sin fotografía.</p>
      <p className="info-note">El pedido se guarda en tu cuenta. Los comercios podrán responder con ofertas mientras siga abierto.</p>
      <div id="product-request-feedback"><FormError message={error} /></div><div className={flow.status} data-tone={uncertain?"warning":error?"error":undefined} role="status">{submitting?"Publicando y esperando confirmación…":uncertain?"Resultado pendiente de confirmar. Conservamos los mismos datos y ubicación para el reintento.":error?"El pedido no tiene confirmación de publicación. Revisá el mensaje indicado.":"Se publicará al confirmar. Podés seguir su estado desde Mis pedidos."}</div><button className="primary-button" disabled={!categories?.length || submitting || (!uncertain && locating)} type="submit"><Megaphone size={17} aria-hidden="true" />{submitting ? "Publicando pedido..." : uncertain ? "Reintentar publicación" : "Publicar pedido"}</button>
    </form>
  </div>;
}



"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Megaphone } from "lucide-react";
import type { CategoryRow, Database, DatabaseNeededWhen } from "@/types/database";
import { requestRadii, requestUrgencies, validateBuyerRequest, type BuyerRequestInput } from "@/lib/buyer-requests";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getPublicCategories } from "@/lib/public-catalog";
import { ensureProfile } from "@/lib/auth/profile";
import { loginUrl } from "@/lib/auth/redirect";
import { useAuth } from "../auth/auth-provider";
import { FormError } from "./request-common";
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
  const [includeLocation, setIncludeLocation] = useState(true);
  const [form, setForm] = useState<BuyerRequestInput>({ title: initialTitle.slice(0, 120), description: "", category_id: "", needed_when: "TODAY", radius_km: 5 });
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
    if (inFlight.current || !categories || (!uncertain && includeLocation && locating)) return;
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
        p_latitude: includeLocation ? coordinates?.latitude ?? null : null,
        p_longitude: includeLocation ? coordinates?.longitude ?? null : null,
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
    } catch {
      const pending = submission.current !== null;
      setUncertain(pending);
      setError(pending ? "No pudimos confirmar si se publicó. Reintentá con los mismos datos y la misma elección de ubicación, o revisá Mis pedidos." : "No pudimos publicar tu pedido. Volvé a intentar.");
      inFlight.current = false; setSubmitting(false);
    }
  }

  return <div className="workflow-narrow"><div className="workflow-heading"><span className="eyebrow"><Megaphone size={15} />PEDIDO ABIERTO</span><h1>Contanos qué necesitás.</h1><p>Guardá tu búsqueda y seguí su estado desde Mis pedidos.</p></div>
    <form className="workflow-form panel" onSubmit={submit} aria-busy={submitting}>
      <label htmlFor="request-title">¿Qué estás buscando?<input id="request-title" name="title" required minLength={3} maxLength={120} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Sensor de cigüeñal Ford Ka 2019" disabled={locked} /></label>
      <label htmlFor="request-description">Descripción <small>Opcional</small><textarea id="request-description" name="description" maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Motor 1.5, necesito retirarlo hoy si es posible." disabled={locked} /></label>
      <div className="form-columns"><label htmlFor="request-category">Categoría<select id="request-category" required value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} disabled={locked || !categories?.length}><option value="">Elegí una categoría</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label htmlFor="request-urgency">¿Cuándo lo necesitás?<select id="request-urgency" value={form.needed_when} onChange={e => setForm({ ...form, needed_when: e.target.value as DatabaseNeededWhen })} disabled={locked}>{Object.entries(requestUrgencies).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {!categories && !categoryError && <p role="status">Cargando categorías...</p>}
      <FormError message={categoryError} />{categoryError && <button type="button" className="outline-button" onClick={() => { setCategoryError(""); setAttempt(value => value + 1); }}>Reintentar categorías</button>}
      {categories?.length === 0 && <p className="info-note">No hay categorías disponibles. Cargalas antes de publicar pedidos.</p>}
      <RequestLocation include={includeLocation} onInclude={setIncludeLocation} disabled={locked} submittedWithLocation={submittedWithLocation} />
      <label htmlFor="request-radius">¿Hasta qué distancia querés buscar?<select id="request-radius" value={form.radius_km} onChange={e => setForm({ ...form, radius_km: Number(e.target.value) })} disabled={locked}>{requestRadii.map(value => <option key={value} value={value}>{value} km</option>)}</select><small>Con ubicación compartida, sólo los comercios dentro del radio podrán ver este pedido en Radar.</small></label>
      <div className="photo-placeholder"><Camera size={23} /><div><strong>Foto opcional</strong><span>Próximamente vas a poder adjuntar una imagen.</span></div><button type="button" disabled>Próximamente</button></div>
      <p className="info-note">El pedido se guarda en tu cuenta. Los comercios podrán responder con ofertas mientras siga abierto.</p>
      <FormError message={error} /><button className="primary-button" disabled={!categories?.length || submitting || (!uncertain && includeLocation && locating)} type="submit"><Megaphone size={17} />{submitting ? "Publicando pedido..." : uncertain ? "Reintentar publicación" : "Publicar pedido"}</button>
    </form>
  </div>;
}



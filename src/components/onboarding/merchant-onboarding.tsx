"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Circle, ArrowRight, Store } from "lucide-react";
import type { BusinessRow } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { merchantOnboardingSteps } from "@/lib/merchant-onboarding";
import { StoreShare } from "../stores/store-share";
import { useMarkStoreShared } from "./use-mark-store-shared";
import styles from "./merchant-onboarding.module.css";

export function MerchantOnboarding({ business }: { business: BusinessRow }) {
  const [result, setResult] = useState<{ token: string; count?: number; error?: true } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = `${business.id}:${business.updated_at}:${business.active}`;
  const markShared = useMarkStoreShared(business.id);
  useEffect(() => {
    let live = true, revision = 0;
    async function load() {
      const current = ++revision;
      setResult(null);
      try {
        const client = getSupabaseBrowserClient(); if (!client) throw new Error("unavailable");
        // Mismos filtros de visibilidad que el catálogo, también para el dueño.
        // HEAD cuenta en PostgreSQL sin descargar productos ni imágenes.
        const { count, error } = await client.from("products")
          .select("id,business:businesses!inner(id)", { count: "exact", head: true })
          .eq("business_id", business.id).eq("active", true).is("admin_blocked_at", null).eq("business.active", true);
        if (error || count === null) throw new Error("unavailable");
        if (live && current === revision) setResult({ token, count });
      } catch { if (live && current === revision) setResult({ token, error: true }); }
    }
    void load(); window.addEventListener("focus", load);
    return () => { live = false; revision++; window.removeEventListener("focus", load); };
  }, [business.id, token, attempt]);
  const current = result?.token === token ? result : null;
  if (!current) return <section className={styles.card} aria-label="Progreso de tu tienda"><h2>Prepará tu tienda para vender mejor</h2><p role="status" className={styles.muted}>Actualizando el progreso de tu tienda…</p></section>;
  if (current.error || current.count === undefined) return <section className={styles.card}><h2>Prepará tu tienda para vender mejor</h2><p role="status" className={styles.muted}>No pudimos actualizar el progreso.</p><button className="secondary-link" onClick={() => setAttempt(value => value + 1)}>Reintentar</button></section>;
  const steps = merchantOnboardingSteps(business, current.count);
  const completed = steps.filter(step => step.complete).length;
  const percent = Math.round(completed / 7 * 100);
  const next = steps.find(step => !step.complete);
  const ready = completed === 7 && business.active;
  const path = `/tienda/${encodeURIComponent(business.slug)}`;
  return <section className={`${styles.card} ${ready ? styles.ready : ""}`} aria-label="Progreso de tu tienda">
    <div className={styles.summary}><span className={styles.eyebrow}><Store size={16} aria-hidden="true" />TU TIENDA EN CERCAYA</span><h2>{ready ? "Tu tienda está completa" : "Prepará tu tienda para vender mejor"}</h2><p className={styles.muted}>{ready ? "Ya tenés todo listo para recibir clientes en CercaYa." : business.active ? "Completá estos pasos para que más personas puedan encontrarte y hacerte pedidos." : "Podés revisar la preparación de tu tienda. No está disponible públicamente mientras esté inactiva."}</p>
      <div className={styles.progressLabel}><strong>{completed} de 7 pasos completados</strong><span>{percent}%</span></div><progress className={styles.progress} value={completed} max={7} aria-label="Pasos completados para preparar tu tienda" />
      {ready ? <div className={styles.readyActions}><Link className="primary-button" href={path} target="_blank" rel="noopener noreferrer">Ver mi tienda</Link><StoreShare name={business.name} slug={business.slug} onShared={markShared} /></div> : next && business.active ? <div className={styles.next}><span className={styles.eyebrow}>TU PRÓXIMO PASO</span><h3>{next.id === "products" ? `Publicá ${5 - Math.min(5, current.count)} producto${current.count === 4 ? "" : "s"} más` : next.title}</h3><p>{next.id === "products" ? `Ya tenés ${Math.min(5, current.count)} de 5 productos publicados.` : next.detail}</p><Link className="primary-button" href={next.href}>{next.action}<ArrowRight size={16} aria-hidden="true" /></Link></div> : null}
    </div>
    {!ready && <ol className={styles.checklist}>{steps.map(step => <li className={`${styles.row} ${step.complete ? styles.done : ""}`} key={step.id}><span className={styles.check}>{step.complete ? <Check size={17} aria-label="Completado" /> : <Circle size={16} aria-label="Pendiente" />}</span><div><strong>{step.title}</strong>{step.id === "products" && <span className={styles.productCount}>{Math.min(5, current.count!)} / 5</span>}{!step.complete && <p>{step.detail}</p>}</div>{!step.complete && (business.active || !["products", "share"].includes(step.id)) && <Link href={step.href} className={styles.stepLink}>{step.action}<ArrowRight size={14} aria-hidden="true" /></Link>}</li>)}</ol>}
  </section>;
}

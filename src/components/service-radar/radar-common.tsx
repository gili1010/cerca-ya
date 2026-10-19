"use client";

import {LoadingState} from "@/components/ui/primitives";
import Link from "next/link";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { PersonalShell } from "@/components/personal-listings/personal-shell";
import { loginUrl } from "@/lib/auth/redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ServiceRequestStatus, ServiceRequestOfferStatus, ServiceRequestView } from "@/types/service-radar";
import { serviceUiError } from "@/lib/services/frontend";
import { Dialog } from "@/components/home/dialog";
import styles from "./service-radar.module.css";

// Drafts only, scoped by account and entity. Never cache remote DTOs or contact details.
const draftMemory = new Map<string, string>();

export const requestLabels: Record<ServiceRequestStatus, string> = { OPEN: "Buscando profesionales", CLOSED: "Solicitud cerrada", CANCELLED: "Solicitud cancelada", EXPIRED: "Solicitud vencida" };
export const offerLabels: Record<ServiceRequestOfferStatus, string> = { PENDING: "Esperando respuesta", ACCEPTED: "Tu propuesta fue elegida", REJECTED: "No seleccionada", WITHDRAWN: "Propuesta retirada" };
export function dateLabel(value: string) { return new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value)); }
export function requestIsOpen(row: ServiceRequestView) { return row.status === "OPEN" && row.available && Date.parse(row.expires_at) > Date.now(); }
export function radarUiError(cause: unknown) {
 if (cause instanceof Error && /^(Esta |Este |Tu |No tenés |Ya existe )/.test(cause.message) && cause.message.length < 350 && !/(https?:|token|SQL|Postgres|Supabase|fetch)/i.test(cause.message)) return cause.message;
 return serviceUiError(cause, "No pudimos completar la operación. Actualizá el estado antes de volver a intentar.");
}
export function radarClient() {
 const client = getSupabaseBrowserClient(); if (!client) throw new Error("No pudimos conectar. Volvé a intentar."); return client;
}

export function RadarFrame({ children }: { children: ReactNode }) {
 const { user, loading } = useAuth(), path = usePathname(), params = useSearchParams(), router = useRouter();
 const returnTo = `${path}${params.size ? `?${params}` : ""}`;
 useEffect(() => { if (!loading && !user) router.replace(loginUrl(returnTo)); }, [loading, user?.id, returnTo, router]);
 return <PersonalShell><nav className={styles.nav} aria-label="Solicitudes y propuestas de servicios">
   <Link href="/necesito-un-servicio" aria-current={path === "/necesito-un-servicio" ? "page" : undefined}>Necesito un servicio</Link>
   <Link href="/mis-solicitudes-servicio" aria-current={path === "/mis-solicitudes-servicio" ? "page" : undefined}>Mis solicitudes de servicios</Link>
   <Link href="/radar-servicios" aria-current={path.startsWith("/radar-servicios") ? "page" : undefined}>Radar de servicios</Link>
   <Link href="/mis-propuestas-servicio" aria-current={path.startsWith("/mis-propuestas-servicio") ? "page" : undefined}>Mis propuestas</Link>
 </nav>{loading ? <p role="status">Comprobando tu sesión…</p> : user ? <Fragment key={user.id}>{children}</Fragment> : <section className={styles.panel}><h1>Encontrá ayuda cerca tuyo</h1><p>Iniciá sesión para solicitar un trabajo o responder como profesional. No necesitás crear un comercio.</p><Link className="primary-button" href={loginUrl(returnTo)}>Iniciar sesión</Link></section>}</PersonalShell>;
}

/** Keyed results hide the previous scope immediately; no polling or new Realtime. */
export function useRadarQuery<T>(scope: string, load: (signal: AbortSignal) => Promise<T>, enabled = true) {
 const { user } = useAuth();
 const [attempt, setAttempt] = useState(0);
 const key = `${user?.id ?? ""}:${scope}:${attempt}`;
 const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
 const reload = useCallback(() => setAttempt(value => value + 1), []);
 useEffect(() => {
   if (!enabled || !user) return;
   let live = true; const controller = new AbortController();
   Promise.resolve().then(() => load(controller.signal)).then(data => { if (live) setResult({ key, data }); }).catch(cause => { if (live) setResult({ key, error: radarUiError(cause) }); });
   return () => { live = false; controller.abort(); };
 }, [key, enabled, user?.id, load]);
 useEffect(() => {
   if (!enabled) return;
   let last = 0;
   const refresh = () => { if (document.visibilityState === "visible" && Date.now()-last>500) { last=Date.now(); reload(); } };
   window.addEventListener("focus", refresh); window.addEventListener("online", refresh);
   document.addEventListener("visibilitychange",refresh);
   return () => { window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh); document.removeEventListener("visibilitychange",refresh); };
 }, [enabled, reload]);
 const current = enabled && result?.key === key ? result : null;
 return { data: current?.data ?? null, error: current?.error ?? "", loading: enabled && !current, reload };
}

export function useExpiryRefresh(values: string[], refresh: () => void) {
 const key = JSON.stringify(values);
 const checked = useRef(new Set<number>());
 useEffect(() => {
   const dates: string[] = JSON.parse(key), now = Date.now();
   const pending = dates.map(Date.parse).filter(value => Number.isFinite(value) && !checked.current.has(value)).sort((a, b) => a - b);
   const next = pending[0];
   if (!next) return;
   const timer = window.setTimeout(() => { for (const value of pending) if (value <= Date.now()) checked.current.add(value); checked.current.add(next); refresh(); }, Math.min(2147483647, Math.max(50, next - now + 100)));
   return () => window.clearTimeout(timer);
 }, [key, refresh]);
}

export function useRadarDraft<T>(key: string, create: () => T, parse: (value: unknown) => T | null) {
 const factory = useRef(create), parser = useRef(parse);
 const [draft, setDraft] = useState<T | null>(null), [error, setError] = useState(""), [warning, setWarning] = useState("");
 const current = useRef<T | null>(null);
 useEffect(() => {
   try {
     const saved = draftMemory.get(key) ?? sessionStorage.getItem(key);
     const value = saved ? parser.current(JSON.parse(saved)) : factory.current();
     if (!value) { setError("No pudimos recuperar este borrador. Revisá tus registros antes de descartarlo."); return; }
     current.current = value; setDraft(value); draftMemory.set(key,JSON.stringify(value)); sessionStorage.setItem(key, JSON.stringify(value));
   } catch {
     // A malformed stored draft must not silently generate a second identifier.
     if (current.current) { setDraft(current.current); setWarning("El borrador sigue en esta pestaña. No la recargues ni cierres hasta confirmar el resultado: el navegador no pudo conservarlo."); }
     else setError("No pudimos recuperar el borrador. Revisá tus registros antes de empezar otro.");
   }
 }, [key]);
 function update(value: T) { current.current = value; setDraft(value); draftMemory.set(key,JSON.stringify(value)); try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { setWarning("Conservamos el borrador en esta pestaña, pero no podemos garantizar su recuperación al recargar o cerrarla."); } }
 function clear() { draftMemory.delete(key); try { sessionStorage.removeItem(key); } catch { /* confirmed remote data remains authoritative */ } }
 function discard() { try { sessionStorage.removeItem(key); } catch { setError("No pudimos descartar el borrador en este navegador."); return; } draftMemory.delete(key); const value = factory.current(); setError(""); update(value); }
 return { draft, update, clear, discard, error, warning };
}

export function RadarFeedback({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
 return <>{loading && <LoadingState label="Cargando información…"/>}{error && <div className={styles.notice}><p role="alert">{error}</p><button type="button" className="outline-button" onClick={retry}>Volver a cargar</button></div>}</>;
}
export function RadarDraftProblem({ error,onDiscard,href }: { error: string; onDiscard: () => void; href: string }) {
 const [confirm,setConfirm]=useState(false);
 return <section className={styles.notice}><p role="alert">{error}</p><Link className="outline-button" href={href}>Revisar mis registros guardados</Link><button className="secondary-link" onClick={()=>setConfirm(true)}>Descartar borrador local</button>{confirm&&<Dialog title="Descartar borrador local" onClose={()=>setConfirm(false)}><div className={styles.modal}><h2>¿Descartar este borrador?</h2><p>Primero revisá tus registros: una operación anterior podría haberse guardado. Esto elimina sólo el borrador de este navegador, no una solicitud o propuesta ya enviada.</p><button className="outline-button" onClick={()=>setConfirm(false)}>Volver</button><button className="danger-button" onClick={()=>{onDiscard();setConfirm(false);}}>Descartar borrador local</button></div></Dialog>}</section>;
}
export function RadarPagination({ page, total, size = 12, onPage }: { page: number; total: number; size?: number; onPage: (value: number) => void }) {
 const last = Math.max(0, Math.ceil(total / size) - 1);
 if (page > last) return <button className="outline-button" onClick={() => onPage(0)}>Volver a la primera página</button>;
 if (total <= size) return null;
 return <nav className={styles.actions} aria-label="Páginas de resultados"><button className="outline-button" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</button><span>{page + 1} / {last + 1}</span><button className="outline-button" disabled={page >= last} onClick={() => onPage(page + 1)}>Siguiente</button></nav>;
}

"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { BUSINESS_DAYS, BUSINESS_EDITOR_DAYS, validateBusinessHours, type BusinessHoursPeriod, type BusinessHoursSchedule } from "@/lib/business-hours";
import { readBusinessHours } from "@/lib/business-hours-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { BusinessHoursStatus } from "./business-hours-status";
import styles from "./business-hours.module.css";

export function BusinessHoursEditor({ businessId, summary = false }: { businessId: string; summary?: boolean }) {
  const [schedule, setSchedule] = useState<BusinessHoursSchedule | null>(null);
  const [periods, setPeriods] = useState<BusinessHoursPeriod[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const inFlight = useRef(false);
  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos cargar los horarios. Volvé a intentar."); return; }
    readBusinessHours(client,businessId).then(result => { if (live) { setSchedule(result); setPeriods(result.periods); setError(""); } })
      .catch(() => { if (live) setError("No pudimos cargar los horarios. Volvé a intentar."); });
    return () => { live = false; };
  }, [businessId,attempt]);
  function replaceDay(day: number, rows: BusinessHoursPeriod[]) {
    setPeriods(current => [...current.filter(p => p.weekday !== day), ...rows.map((p,i) => ({ ...p, weekday: day, period_index: i }))]);
    setNotice("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !schedule) return;
    const invalid = validateBusinessHours(periods);
    if (invalid) { setError(invalid); return; }
    inFlight.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { error: failure } = await client.rpc("set_my_business_hours",{p_business_id:businessId,p_schedule:periods.map(p=>({...p}))});
      if (failure) throw failure;
      setSchedule({ configured:true, periods:[...periods] }); setNotice("Horarios guardados.");
    } catch (cause) {
      const message = typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
      setError(message.includes("account_suspended") ? "Tu cuenta está suspendida." : message.includes("BUSINESS_HOURS_OVERLAP") ? "Hay franjas superpuestas. Revisá los horarios." : message.includes("BUSINESS_HOURS_INVALID") ? "Revisá los horarios ingresados." : "No pudimos guardar los horarios. Volvé a intentar.");
    } finally { inFlight.current=false; setBusy(false); }
  }
  return <section id={summary ? undefined : "horarios"} className={summary ? styles.summary : `workflow-narrow ${styles.editor}`} aria-label="Horarios de atención">
    <h2>Horarios de atención</h2>
    {error && <p role="alert" className="form-error">{error}</p>}
    {!schedule ? error ? <button type="button" className="outline-button" onClick={()=>setAttempt(n=>n+1)}>Reintentar</button> : <p role="status">Cargando horarios…</p> : summary ? <><BusinessHoursStatus schedule={schedule} /><Link className="secondary-link" href="/comercio/editar#horarios">Editar horarios</Link></> : <form onSubmit={save}>
      <p className={styles.note}>Hasta dos franjas por día. Si el cierre es anterior a la apertura, cierra al día siguiente. Los horarios no garantizan stock ni envío.</p>
      {!schedule.configured && <p className="info-note">Todavía no informaste horarios. Al guardar con todos los días cerrados, tu tienda mostrará “Cerrado”.</p>}
      <fieldset disabled={busy} className={styles.days}>
      {BUSINESS_EDITOR_DAYS.map(day => {
        const rows = periods.filter(p=>p.weekday===day).sort((a,b)=>a.period_index-b.period_index);
        return <div key={day} className={styles.day}>
          <div className={styles.dayHeading}><h3>{BUSINESS_DAYS[day]}</h3><label><input type="checkbox" checked={!rows.length} onChange={event=>replaceDay(day,event.target.checked ? [] : [{weekday:day,period_index:0,opens_at:"09:00",closes_at:"18:00"}])} />Cerrado</label></div>
          {rows.map((p,i)=><div className={styles.period} key={p.period_index}>
            <label>Desde<input type="time" required step="60" aria-label={`${BUSINESS_DAYS[day]} desde, franja ${i+1}`} value={p.opens_at} onChange={event=>replaceDay(day,rows.map((row,index)=>index===i?{...row,opens_at:event.target.value}:row))} /></label>
            <label>Hasta<input type="time" required step="60" aria-label={`${BUSINESS_DAYS[day]} hasta, franja ${i+1}`} value={p.closes_at} onChange={event=>replaceDay(day,rows.map((row,index)=>index===i?{...row,closes_at:event.target.value}:row))} /></label>
            <button type="button" className={styles.textButton} aria-label={`Quitar franja ${i+1} del ${BUSINESS_DAYS[day]}`} onClick={()=>replaceDay(day,rows.filter((_,index)=>index!==i))}>Quitar</button>
          </div>)}
          {!!rows.length && <div className={styles.dayActions}>{rows.length<2 && <button type="button" className={styles.textButton} onClick={()=>replaceDay(day,[...rows,{weekday:day,period_index:1,opens_at:"19:00",closes_at:"22:00"}])}>+ Agregar otro horario</button>}{day===1 && <button type="button" className={styles.textButton} onClick={()=>{ setPeriods(current=>[...current.filter(p=>p.weekday===0||p.weekday===6),...[1,2,3,4,5].flatMap(weekday=>rows.map((p,i)=>({...p,weekday,period_index:i})))]); setNotice(""); }}>Aplicar de lunes a viernes</button>}</div>}
        </div>;
      })}
      </fieldset><div className={styles.save}><button type="submit" className="primary-button" disabled={busy}>{busy?"Guardando horarios…":"Guardar horarios"}</button>{notice && <p role="status">{notice}</p>}</div>
    </form>}
  </section>;
}

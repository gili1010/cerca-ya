"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Clock3, Check, Copy } from "lucide-react";
import { BUSINESS_DAYS, BUSINESS_EDITOR_DAYS, formatBusinessDay, validateBusinessHours, type BusinessHoursPeriod, type BusinessHoursSchedule } from "@/lib/business-hours";
import { readBusinessHours } from "@/lib/business-hours-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Dialog } from "../home/dialog";
import { BusinessHoursStatus } from "./business-hours-status";
import { BusinessHoursTimeSelect } from "./business-hours-time-select";
import styles from "./business-hours.module.css";

const shortDays = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
function scheduleSummary(schedule: BusinessHoursSchedule) {
  if (!schedule.configured) return ["Horario no informado"];
  const groups: { first: number; last: number; hours: string }[] = [];
  for (const day of BUSINESS_EDITOR_DAYS) {
    const hours = formatBusinessDay(schedule.periods.filter(p => p.weekday === day));
    const previous = groups.at(-1);
    if (previous?.hours === hours) previous.last = day;
    else groups.push({ first: day, last: day, hours });
  }
  if (groups.length > 3) return ["Horarios configurados"];
  return groups.map(group => `${group.first === group.last ? shortDays[group.first] : `${shortDays[group.first]}–${shortDays[group.last]}`} · ${group.hours}`);
}
const comparable = (periods: BusinessHoursPeriod[]) => JSON.stringify([...periods].sort((a,b) => a.weekday-b.weekday || a.period_index-b.period_index));

export function BusinessHoursEditor({ businessId, summary = false, disabled = false }: { businessId: string; summary?: boolean; disabled?: boolean }) {
  const [schedule, setSchedule] = useState<BusinessHoursSchedule | null>(null);
  const [periods, setPeriods] = useState<BusinessHoursPeriod[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const inFlight = useRef(false);
  useEffect(() => {
    let live = true;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("No pudimos cargar los horarios. Volvé a intentar."); return; }
    readBusinessHours(client,businessId).then(result => { if (live) { setSchedule(result); setPeriods(result.periods); setError(""); } })
      .catch(() => { if (live) setError("No pudimos cargar los horarios. Volvé a intentar."); });
    return () => { live = false; };
  }, [businessId,attempt]);
  function edit() {
    if (!schedule) return;
    setPeriods(schedule.periods.map(p => ({ ...p }))); setError(""); setNotice(""); setDiscard(false); setOpen(true);
  }
  function close() {
    if (inFlight.current) return;
    if (schedule && comparable(periods) !== comparable(schedule.periods)) setDiscard(true);
    else setOpen(false);
  }
  function replaceDay(day: number, rows: BusinessHoursPeriod[]) {
    setPeriods(current => [...current.filter(p => p.weekday !== day), ...rows.map((p,i) => ({ ...p, weekday: day, period_index: i }))]);
    setError(""); setDiscard(false);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); event.stopPropagation();
    if (inFlight.current || !schedule) return;
    const invalid = validateBusinessHours(periods);
    if (invalid) { setError(invalid); return; }
    inFlight.current = true; setBusy(true); setError("");
    try {
      const client = getSupabaseBrowserClient();
      if (!client) throw new Error("unavailable");
      const { error: failure } = await client.rpc("set_my_business_hours",{p_business_id:businessId,p_schedule:periods.map(p=>({...p}))});
      if (failure) throw failure;
      setSchedule({ configured:true, periods:[...periods] }); setNotice("Horarios actualizados. Ya están guardados."); setOpen(false);
    } catch (cause) {
      const message = typeof cause === "object" && cause !== null && "message" in cause ? String(cause.message) : "";
      setError(message.includes("account_suspended") ? "Tu cuenta está suspendida." : message.includes("BUSINESS_HOURS_OVERLAP") ? "Hay franjas superpuestas. Revisá los horarios." : message.includes("BUSINESS_HOURS_INVALID") ? "Revisá los horarios ingresados." : "No pudimos guardar los horarios. Volvé a intentar.");
    } finally { inFlight.current=false; setBusy(false); }
  }
  return <section id={summary ? undefined : "horarios"} className={styles.summary} aria-label="Horarios de atención">
    <div className={styles.cardHeading}><span className={styles.clock}><Clock3 size={20} aria-hidden="true" /></span><div><h2>Horarios de atención</h2><p>{summary ? "Cuándo pueden encontrarte tus clientes." : "Se guardan por separado de los datos del comercio."}</p></div></div>
    {!open && error && <p role="alert" className="form-error">{error}</p>}
    {!schedule ? error ? <button type="button" className="outline-button" onClick={()=>setAttempt(n=>n+1)}>Reintentar</button> : <p role="status">Cargando horarios…</p> : <>
      {summary ? <BusinessHoursStatus schedule={schedule} /> : <div className={styles.scheduleSummary}>{scheduleSummary(schedule).map(line => <p key={line}>{line}</p>)}</div>}
      <button type="button" className={styles.editButton} disabled={disabled} onClick={edit}><Clock3 size={17} aria-hidden="true" />Editar horarios</button>
      {notice && <p className={styles.success} role="status"><Check size={17} aria-hidden="true" />{notice}</p>}
    </>}
    {open && createPortal(<Dialog title="Horarios de atención" className={styles.editorDialog} onClose={close} preventCancel>
      <form onSubmit={save} className={styles.modalLayout}>
        <header className={styles.modalHeader}><span className={styles.eyebrow}><Clock3 size={16} aria-hidden="true" />TU SEMANA</span><h2>Horarios de atención</h2><p>Indicá cuándo está abierto tu comercio.</p></header>
        <div className={styles.modalBody}>
          <p className={styles.note}>Hasta dos horarios por día. Si cierra después de medianoche, elegí la hora del día siguiente.</p>
          {!schedule?.configured && <p className={styles.hint}>Si guardás todos los días cerrados, tu tienda mostrará “Cerrado”.</p>}
          <fieldset disabled={busy} className={styles.days}>
          {BUSINESS_EDITOR_DAYS.map(day => {
            const rows = periods.filter(p=>p.weekday===day).sort((a,b)=>a.period_index-b.period_index);
            return <div key={day} className={styles.day}>
              <div className={styles.dayHeading}><h3>{BUSINESS_DAYS[day]}</h3><label><input type="checkbox" checked={!rows.length} onChange={event=>replaceDay(day,event.target.checked ? [] : [{weekday:day,period_index:0,opens_at:"09:00",closes_at:"18:00"}])} />Cerrado</label></div>
              {!rows.length && <p className={styles.closedDay}>Sin atención este día</p>}
              {rows.map((p,i)=><div className={styles.period} key={p.period_index}>
                {i === 1 && <strong className={styles.periodTitle}>Segundo horario</strong>}
                <BusinessHoursTimeSelect label="Desde" description={`${BUSINESS_DAYS[day]}, horario ${i+1}`} value={p.opens_at} onChange={value=>replaceDay(day,rows.map((row,index)=>index===i?{...row,opens_at:value}:row))} />
                <BusinessHoursTimeSelect label="Hasta" description={`${BUSINESS_DAYS[day]}, horario ${i+1}`} value={p.closes_at} onChange={value=>replaceDay(day,rows.map((row,index)=>index===i?{...row,closes_at:value}:row))} />
                {p.closes_at < p.opens_at && <p className={styles.overnight}>Cierra al día siguiente</p>}
                {i === 1 && <button type="button" className={styles.removeButton} onClick={()=>replaceDay(day,rows.slice(0,1))}>Quitar segundo horario</button>}
              </div>)}
              {!!rows.length && <div className={styles.dayActions}>{rows.length<2 && <button type="button" className={styles.textButton} onClick={()=>replaceDay(day,[...rows,{weekday:day,period_index:1,opens_at:"19:00",closes_at:"22:00"}])}>+ Agregar otro horario</button>}{day===1 && <button type="button" className={styles.copyButton} onClick={()=>{ setPeriods(current=>[...current.filter(p=>p.weekday===0||p.weekday===6),...[1,2,3,4,5].flatMap(weekday=>rows.map((p,i)=>({...p,weekday,period_index:i})))]); setError(""); setDiscard(false); }}><Copy size={15} aria-hidden="true" />Aplicar de lunes a viernes</button>}</div>}
            </div>;
          })}
          </fieldset>
        </div>
        <footer className={styles.modalFooter}>
          {error && <p role="alert" className={styles.modalError}>{error}</p>}
          {discard ? <><p role="alert" className={styles.discardNote}>Tenés cambios sin guardar. ¿Querés descartarlos?</p><div className={styles.footerActions}><button type="button" className="outline-button" onClick={()=>setDiscard(false)}>Seguir editando</button><button type="button" className={styles.discardButton} onClick={()=>{setOpen(false);setDiscard(false);setError("");}}>Descartar cambios</button></div></> : <><p className={styles.footerHint}>Guardar horarios los actualiza directamente en tu tienda.</p><div className={styles.footerActions}><button type="button" className="outline-button" disabled={busy} onClick={close}>Cancelar</button><button type="submit" className="primary-button" disabled={busy}>{busy?"Guardando…":"Guardar horarios"}</button></div></>}
        </footer>
      </form>
    </Dialog>, document.body)}
  </section>;
}

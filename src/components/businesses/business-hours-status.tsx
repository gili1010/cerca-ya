"use client";
import { useEffect, useState } from "react";
import { BUSINESS_DAYS, BUSINESS_EDITOR_DAYS, formatBusinessDay, getBusinessHoursState, type BusinessHoursSchedule } from "@/lib/business-hours";
import { Dialog } from "../home/dialog";
import styles from "./business-hours.module.css";

export function BusinessHoursStatus({ schedule }: { schedule: BusinessHoursSchedule }) {
  const [now, setNow] = useState<Date | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => { setNow(new Date()); timer = setTimeout(update, 60000 - Date.now() % 60000); };
    update();
    const visible = () => { if (!document.hidden) setNow(new Date()); };
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, []);
  if (!schedule.configured) return <div className={styles.status}><span className={styles.neutral}>Horario no informado</span></div>;
  if (!now) return <div className={styles.status} aria-busy="true">Consultando horario…</div>;
  const state = getBusinessHoursState(schedule, now);
  return <div className={styles.status}>
    <p className={state.state === "OPEN" ? styles.open : styles.neutral}><span className={styles.dot} aria-hidden="true" />{state.label}</p>
    <div className={styles.today}><span>Hoy · {formatBusinessDay(state.today)}</span><button type="button" onClick={() => setOpen(true)}>Ver horarios</button></div>
    {open && <Dialog title="Horarios de atención" className={styles.dialog} onClose={() => setOpen(false)}><h2>Horarios de atención</h2><p className={styles.note}>Horario del comercio. No garantiza stock, envío ni confirmación de pedidos.</p><dl className={styles.week}>
      {BUSINESS_EDITOR_DAYS.map(day => <div key={day} className={day === state.weekday ? styles.currentDay : undefined}><dt>{BUSINESS_DAYS[day]}{day === state.weekday && <small>Hoy</small>}</dt><dd>{formatBusinessDay(schedule.periods.filter(p => p.weekday === day))}</dd></div>)}
    </dl><button className="outline-button" type="button" onClick={() => setOpen(false)}>Cerrar</button></Dialog>}
  </div>;
}

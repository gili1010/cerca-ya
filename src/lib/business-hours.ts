export const BUSINESS_TIME_ZONE = "America/Argentina/Cordoba";
export const BUSINESS_DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;
export const BUSINESS_EDITOR_DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export interface BusinessHoursPeriod { weekday: number; period_index: number; opens_at: string; closes_at: string }
export interface BusinessHoursSchedule { configured: boolean; periods: BusinessHoursPeriod[] }
const DAY = 1440, WEEK = 7 * DAY;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
function minutes(time: string) { return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5)); }
function intervals(periods: BusinessHoursPeriod[]) {
  return periods.map(p => {
    const start = p.weekday * DAY + minutes(p.opens_at), closing = minutes(p.closes_at);
    return { start, end: p.weekday * DAY + closing + (closing < minutes(p.opens_at) ? DAY : 0) };
  });
}
export function validateBusinessHours(periods: BusinessHoursPeriod[]): string | null {
  if (periods.length > 14) return "Podés agregar hasta dos franjas por día.";
  const keys = new Set<string>();
  for (const p of periods) {
    if (!Number.isInteger(p.weekday) || p.weekday < 0 || p.weekday > 6 || ![0, 1].includes(p.period_index)
      || !timePattern.test(p.opens_at) || !timePattern.test(p.closes_at)) return "Revisá los días y horarios ingresados.";
    if (p.opens_at === p.closes_at) return "La apertura y el cierre deben ser distintos. Si cierra después de medianoche, elegí la hora del día siguiente.";
    const key = `${p.weekday}-${p.period_index}`;
    if (keys.has(key)) return "Podés agregar hasta dos franjas distintas por día.";
    keys.add(key);
  }
  const base = intervals(periods);
  for (let i = 0; i < base.length; i++) for (let j = i + 1; j < base.length; j++) {
    for (const shift of [-WEEK, 0, WEEK]) {
      if (base[i].start < base[j].end + shift && base[j].start + shift < base[i].end)
        return "Hay horarios duplicados o superpuestos, incluso entre días consecutivos. Revisalos antes de guardar.";
    }
  }
  return null;
}
const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
export function getBusinessHoursState(schedule: BusinessHoursSchedule, now: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(p => [p.type, p.value]));
  const weekday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay();
  const current = weekday * DAY + Number(parts.hour) * 60 + Number(parts.minute);
  const today = schedule.periods.filter(p => p.weekday === weekday).sort((a,b) => a.opens_at.localeCompare(b.opens_at));
  const common = { weekday, today, closesAt: null as string | null, nextOpening: null as { weekday: number; daysAway: number; time: string } | null };
  if (!schedule.configured) return { ...common, state: "NO_SCHEDULE" as const, label: "Horario no informado" };
  const base = intervals(schedule.periods);
  const expanded = [-WEEK, 0, WEEK, WEEK * 2].flatMap(shift => base.map(p => ({ start: p.start + shift, end: p.end + shift }))).sort((a,b) => a.start-b.start);
  const merged: { start: number; end: number }[] = [];
  for (const p of expanded) {
    const last = merged.at(-1);
    if (last && p.start <= last.end) last.end = Math.max(last.end, p.end);
    else merged.push({ ...p });
  }
  const active = merged.find(p => current >= p.start && current < p.end);
  const formatTime = (n: number) => `${String(Math.floor((n % DAY + DAY) % DAY / 60)).padStart(2,"0")}:${String((n % 60 + 60) % 60).padStart(2,"0")}`;
  if (active) {
    const continuous = base.reduce((sum,p) => sum + p.end-p.start,0) === WEEK;
    const closesAt = continuous ? null : formatTime(active.end);
    return { ...common, state: "OPEN" as const, closesAt, label: closesAt ? `Abierto ahora · hasta las ${closesAt}` : "Abierto ahora · atención continua" };
  }
  const next = merged.find(p => p.start > current);
  if (!next) return { ...common, state: "CLOSED" as const, label: "Cerrado" };
  const daysAway = Math.floor(next.start / DAY) - weekday;
  const nextOpening = { weekday: (Math.floor(next.start / DAY) % 7 + 7) % 7, daysAway, time: formatTime(next.start) };
  const when = daysAway === 0 ? "hoy" : daysAway === 1 ? "mañana" : `el ${BUSINESS_DAYS[nextOpening.weekday]}`;
  return { ...common, state: "CLOSED" as const, nextOpening, label: `Cerrado · abre ${when} a las ${nextOpening.time}` };
}
export function formatBusinessDay(periods: BusinessHoursPeriod[]) {
  return periods.length ? [...periods].sort((a,b) => a.opens_at.localeCompare(b.opens_at)).map(p => `${p.opens_at}–${p.closes_at}${p.closes_at < p.opens_at ? " (día siguiente)" : ""}`).join(" / ") : "Cerrado";
}

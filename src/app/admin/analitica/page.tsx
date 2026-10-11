import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { readAnalytics, type AnalyticsFilters, type AnalyticsTerm } from "@/lib/admin/analytics";
import { AdminHeading, adminDate } from "@/components/admin/admin-common";
import styles from "@/components/admin/admin.module.css";
import analyticsStyles from "@/components/admin/analytics.module.css";

type Params = Record<string, string | string[] | undefined>;
const num = (value: string | string[] | undefined, fallback: number) => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : fallback;
function href(filters: AnalyticsFilters, section: "opportunities" | "top", page: number) {
  const params = new URLSearchParams({ dias: String(filters.days), localidad: filters.locality, minimo: String(filters.minimum), oportunidades: String(section === "opportunities" ? page : filters.opportunityPage), top: String(section === "top" ? page : filters.topPage) });
  return `/admin/analitica?${params.toString()}#${section}`;
}
function Trends({ rows, total, filters, opportunity = false }: { rows: AnalyticsTerm[]; total: number; filters: AnalyticsFilters; opportunity?: boolean }) {
  const page = opportunity ? filters.opportunityPage : filters.topPage;
  const section = opportunity ? "opportunities" : "top";
  const pages = Math.max(1, Math.ceil(total / 20));
  return <section id={section} className={analyticsStyles.section}>
    <h2>{opportunity ? "Productos que la gente busca y no encuentra" : "Lo más buscado"}</h2>
    {opportunity && <p className={styles.muted}>Ordenado por búsquedas sin resultados, luego por su porcentaje. Mínimo: {filters.minimum} búsqueda{filters.minimum === 1 ? "" : "s"}.</p>}
    <div className={styles.panel}>{rows.length ? <div className={styles.tableWrap} role="region" aria-label={opportunity ? "Oportunidades de productos" : "Búsquedas más frecuentes"} tabIndex={0}><table className={styles.table}>
      <thead><tr><th scope="col">Búsqueda</th><th scope="col">{opportunity ? "Búsquedas totales" : "Cantidad"}</th><th scope="col">Con resultados</th><th scope="col">Sin resultados</th>{opportunity && <><th scope="col">% sin resultados</th><th scope="col">Última búsqueda</th></>}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.term}><td><strong>{row.display_term}</strong></td><td>{row.total.toLocaleString("es-AR")}</td><td>{row.with_results.toLocaleString("es-AR")}</td><td><span className={`${styles.badge} ${row.without_results > 0 ? styles.blocked : styles.inactive}`}>{row.without_results.toLocaleString("es-AR")}</span></td>{opportunity && <><td>{row.zero_rate.toLocaleString("es-AR")}%</td><td>{adminDate(row.last_search)}</td></>}</tr>)}</tbody>
    </table></div> : <p className={styles.empty}>{total > 0 ? "No hay resultados en esta página. Volvé a la primera página." : "Todavía no hay suficientes búsquedas para mostrar tendencias."}</p>}</div>
    {total > 20 && <nav className={styles.pagination} aria-label={`Páginas de ${opportunity ? "oportunidades" : "lo más buscado"}`}><span>{total} términos · Página {page} de {pages}</span><div>{page > 1 && <Link className={styles.button} href={href(filters, section, page - 1)}>Anterior</Link>}{page < pages && <Link className={styles.button} href={href(filters, section, page + 1)}>Siguiente</Link>}</div></nav>}
    {page > pages && <BackLink href={href(filters, section, 1)}>Volver a la primera página</BackLink>}
  </section>;
}
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const days = num(params.dias, 30), minimum = num(params.minimo, 2);
  const filters: AnalyticsFilters = { days: [7,30,90].includes(days) ? days : 30, minimum: [1,2,3].includes(minimum) ? minimum : 2,
    locality: typeof params.localidad === "string" ? params.localidad.slice(0,120) : "",
    opportunityPage: Math.min(100000, Math.max(1, num(params.oportunidades, 1))), topPage: Math.min(100000, Math.max(1, num(params.top, 1))) };
  const data = await readAnalytics(filters);
  if (!data.localities.includes(filters.locality)) filters.locality = "";
  const values = [["Búsquedas totales", data.summary.total.toLocaleString("es-AR")], ["Con resultados", data.summary.with_results.toLocaleString("es-AR")], ["Sin resultados", data.summary.without_results.toLocaleString("es-AR")], ["Tasa sin resultados", `${data.summary.zero_rate.toLocaleString("es-AR")}%`]];
  return <><AdminHeading title="Analítica" description="Demanda real de productos y oportunidades para sumar oferta." />
    <form className={styles.filters} method="get"><label>Período<select name="dias" defaultValue={filters.days}><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option></select></label>
      {data.localities.length > 0 && <label>Localidad<select name="localidad" defaultValue={filters.locality}><option value="">Todas</option>{data.localities.map(locality => <option key={locality}>{locality}</option>)}</select></label>}
      <label>Mínimo para oportunidades<select name="minimo" defaultValue={filters.minimum}><option value="1">Todas las búsquedas</option><option value="2">2 búsquedas</option><option value="3">3 búsquedas</option></select></label><button className={styles.primaryButton}>Aplicar</button></form>
    <dl className={`${styles.metrics} ${analyticsStyles.metrics}`}>{values.map(([label,value]) => <div className={styles.metric} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <p className={styles.muted}>Contamos búsquedas enviadas con Buscar o Enter. Los resultados reflejan los filtros vigentes en ese momento; no son cantidades vendidas.</p>
    <Trends rows={data.opportunities} total={data.opportunities_total} filters={filters} opportunity /><Trends rows={data.top} total={data.top_total} filters={filters} />
  </>;
}

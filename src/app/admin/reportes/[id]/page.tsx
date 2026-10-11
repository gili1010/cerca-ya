import { BackLink } from "@/components/navigation/back-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readAdminPhase2, requireAdmin } from "@/lib/admin/server";
import type { AdminPage } from "@/lib/admin/types";
import { validAdminId, reportStatusLabels, type AdminReport } from "@/lib/admin/phase2-types";
import { AdminHeading, adminDate } from "@/components/admin/admin-common";
import { SupportBadge } from "@/components/admin/support-common";
import { ReportResolution } from "@/components/admin/report-resolution";
import styles from "@/components/admin/admin.module.css";
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("/admin/reportes"); const { id } = await params; if (!validAdminId(id)) notFound();
  const data = await readAdminPhase2<AdminPage<AdminReport>>("report", `/admin/reportes/${id}`, undefined, id);
  const r = data.rows[0]; if (!r) notFound();
  const adminLink = r.entity_type === "business" ? `/admin/comercios/${r.entity_id}` : `/admin/productos/${r.entity_id}`;
  const publicLink = r.entity_type === "product" ? `/producto/${r.entity_id}` : r.business_slug ? `/tienda/${encodeURIComponent(r.business_slug)}` : null;
  return <><BackLink href="/admin/reportes">Reportes</BackLink><AdminHeading title="Detalle del reporte" description="Revisá la denuncia antes de decidir una acción." /><SupportBadge label={reportStatusLabels[r.status]} warning={r.status === "OPEN"} /><section className={`${styles.panel} ${styles.detail}`}><dl className={styles.facts}><div><dt>Motivo</dt><dd>{r.reason}</dd></div><div><dt>Fecha</dt><dd>{adminDate(r.created_at)}</dd></div><div><dt>Reportante</dt><dd><Link href={`/admin/usuarios/${r.reporter_user_id}`}>{r.reporter_name || "Sin nombre"}</Link></dd></div><div><dt>Recurso denunciado</dt><dd>{r.resource_name || "No disponible"} · {r.entity_type === "business" ? "Comercio" : "Producto"}</dd></div></dl><h2>Comentario</h2><p className={styles.description}>{r.details || "Sin comentario adicional."}</p><div className={styles.dialogActions}><Link className={styles.button} href={adminLink}>{r.entity_type === "business" ? "Ver comercio en Admin" : "Ver producto en Admin"}</Link>{publicLink && <Link className={styles.button} href={publicLink} target="_blank" rel="noopener noreferrer">Ver recurso público ↗</Link>}</div><p className={styles.muted}>El recurso público puede no estar disponible si fue suspendido o bloqueado.</p></section>{r.status === "OPEN" ? <><p className={styles.muted}>Resolver o descartar no modifica el comercio ni el producto. Para moderarlo, usá sus acciones de administración.</p><ReportResolution id={r.id} /></> : <section className={`${styles.panel} ${styles.detail}`}><h2>Resolución</h2><p>{r.resolution_note || "Sin nota administrativa."}</p><p className={styles.muted}>{r.resolved_at && adminDate(r.resolved_at)}</p></section>}</>;
}

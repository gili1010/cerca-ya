import Link from "next/link";
import { notFound } from "next/navigation";
import { readAdmin, requireAdmin } from "@/lib/admin/server";
import type { AdminBusiness, AdminPage } from "@/lib/admin/types";
import { AdminBadge, AdminHeading, adminDate } from "@/components/admin/admin-common";
import { AdminStatusAction } from "@/components/admin/admin-status-action";
import styles from "@/components/admin/admin.module.css";
import { AdminBusinessVerification } from "@/components/admin/business-verification";
import type { BusinessVerification } from "@/lib/admin/verification-types";

export default async function AdminBusinessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await requireAdmin("/admin/comercios");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const data = await readAdmin<AdminPage<AdminBusiness>>("business", `/admin/comercios/${id}`, undefined, id);
  const b = data.rows[0];
  if (!b) notFound();
  const { data: verification, error: verificationError } = await client.rpc("admin_read_business_verification", { p_business_id: id });
  if (verificationError || !verification) throw new Error("No pudimos cargar la verificación del comercio. Volvé a intentar.");
  const facts = [["Dirección de tienda", `/tienda/${b.slug}`], ["Localidad", b.city || "Sin informar"], ["Propietario", b.owner_name || "Sin nombre informado"], ["Categorías", b.categories.join(", ") || "Sin categorías"], ["Entrega", [b.pickup_enabled ? "Retiro" : "", b.delivery_enabled ? "Envío" : ""].filter(Boolean).join(" · ") || "Sin informar"], ["Fecha de alta", adminDate(b.created_at)], ["Productos", String(b.product_count)]];
  return <><Link href="/admin/comercios" className={styles.button}>← Comercios</Link><AdminHeading title={b.name} description="Información pública y estado administrativo." /><AdminBadge active={b.active} blocked={Boolean(b.admin_suspended_at)} business /><section className={`${styles.panel} ${styles.detail}`}><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.description}>{b.description || "Sin descripción"}</p><Link className={styles.button} href={`/tienda/${encodeURIComponent(b.slug)}`} target="_blank" rel="noopener noreferrer">Ver tienda pública ↗</Link>{!b.active && <p className={styles.muted}>La tienda no está disponible públicamente mientras el comercio esté inactivo.</p>}</section><AdminBusinessVerification id={b.id} name={b.name} verification={verification as unknown as BusinessVerification} /><AdminStatusAction entity="business" id={b.id} name={b.name} blocked={Boolean(b.admin_suspended_at)} /></>;
}

import { BackLink } from "@/components/navigation/back-link";
import { AdminHeading } from "@/components/admin/admin-common";
import styles from "@/components/admin/admin.module.css";

export default function BackPreview() {
  return <div className={styles.shell}><header className={styles.topbar}><span className={styles.brand}>CercaYa <span>Admin</span></span><BackLink href="/">Volver a CercaYa</BackLink></header><main className={styles.main}><BackLink href="/admin/comercios">Comercios</BackLink><AdminHeading title="Vista visual de detalle Admin" description="QA temporal, sin acceso a datos ni operaciones administrativas." /><section className={`${styles.panel} ${styles.detail}`}><h2>Información del comercio</h2><p>Vista de presentación del patrón de regreso.</p></section></main></div>;
}

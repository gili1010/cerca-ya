import type { ServicePricingMode } from "@/types/services";
import { servicePriceLabel } from "@/lib/services/frontend";
import styles from "./service-radar.module.css";

/** Shared presentation; amounts and eligibility still come from each existing flow. */
export function ProposalBudget({ mode, price }: { mode: ServicePricingMode; price: number | null }) {
  return <div className={styles.budget}>
    <span className={styles.meta}>{mode === "FIXED" ? "Precio fijo" : mode === "FROM" ? "Precio desde" : "A presupuestar"}</span>
    <strong className={styles.price}>{servicePriceLabel(mode, price)}</strong>
    <p className={styles.meta}>{mode === "FIXED" ? "Importe para el trabajo descrito en esta propuesta." : mode === "FROM" ? "El importe puede aumentar según el trabajo." : "El precio se definirá después de evaluar el trabajo."}</p>
  </div>;
}

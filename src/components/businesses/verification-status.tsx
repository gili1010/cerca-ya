import { BadgeCheck } from "lucide-react";
import styles from "./verification.module.css";
export function VerificationStatus({ verified }: { verified: boolean }) {
  return <section className={styles.status} aria-label="Verificación del comercio"><strong>{verified && <BadgeCheck size={16} aria-hidden="true" />}{verified ? "Comercio verificado" : "Comercio no verificado"}</strong><p>{verified ? "CercaYa verificó tu comercio." : "Más adelante vas a poder solicitar la verificación de tu comercio."}</p></section>;
}

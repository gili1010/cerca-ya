import type { ButtonHTMLAttributes, ReactNode } from "react";
import { AlertCircle, Search } from "lucide-react";
import styles from "./primitives.module.css";

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" }) {
 const classes = { primary: "primary-button", secondary: "secondary-button", outline: "outline-button", ghost: "ghost-button", danger: "danger-button" };
 return <button type="button" {...props} className={`${classes[variant]} ${className}`}/>;
}

export function SectionHeader({ title, description, eyebrow, actions, level = 2 }: { title: string; description?: string; eyebrow?: string; actions?: ReactNode; level?: 2 | 3 }) {
 const Heading = level === 3 ? "h3" : "h2";
 return <div className={styles.heading}><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<Heading>{title}</Heading>{description && <p>{description}</p>}</div>{actions && <div className={styles.actions}>{actions}</div>}</div>;
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "error" | "info" }) {
 return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>;
}

export function EmptyState({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
 return <section className={styles.state}><Search size={24} aria-hidden="true"/><SectionHeader title={title} description={description}/>{children && <div className={styles.actions}>{children}</div>}</section>;
}

export function ErrorState({ message, onRetry, retryLabel = "Volver a cargar" }: { message: string; onRetry?: () => void; retryLabel?: string }) {
 return <div className={`${styles.feedback} ${styles.error}`}><AlertCircle size={20} aria-hidden="true"/><div><p role="alert">{message}</p>{onRetry && <Button variant="outline" onClick={onRetry}>{retryLabel}</Button>}</div></div>;
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
 return <div className={styles.loading} role="status" aria-live="polite"><span className={styles.loadingLabel}>{label}</span><div aria-hidden="true" className={styles.loadingLines}><span className="skeleton skeleton-line"/><span className="skeleton skeleton-line skeleton-short"/></div></div>;
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import styles from "./global-navigation.module.css";

export function NavigationItem({ href, label, description, icon: Icon, active = false, onNavigate }: { href: string; label: string; description?: string; icon: LucideIcon; active?: boolean; onNavigate?: () => void }) {
 return <Link href={href} className={styles.menuItem} aria-current={active ? "page" : undefined} onClick={onNavigate}><span className={styles.itemIcon}><Icon size={19} aria-hidden="true"/></span><span><strong>{label}</strong>{description && <small>{description}</small>}</span></Link>;
}

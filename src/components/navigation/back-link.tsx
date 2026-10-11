import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentProps } from "react";
import styles from "./back-navigation.module.css";

export function BackLink({ children, className, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props} className={`${styles.back}${className ? ` ${className}` : ""}`}>
    <ArrowLeft size={17} aria-hidden="true" /><span>{children}</span>
  </Link>;
}

export function BackButton({ children, className, ...props }: ComponentProps<"button">) {
  return <button {...props} className={`${styles.back}${className ? ` ${className}` : ""}`}>
    <ArrowLeft size={17} aria-hidden="true" /><span>{children}</span>
  </button>;
}

"use client";

import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { loginUrl } from "@/lib/auth/redirect";
import styles from "./personal-listings.module.css";

export function PublicationAuthGate({ children, returnTo, services = false }: { children: ReactNode; returnTo: string; services?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="workflow-loading" role="status">Comprobando tu sesión…</p>;
  if (!user) return <section className={`panel ${styles.authPrompt}`}><span className={styles.symbol}><UserRound size={28} aria-hidden="true" /></span>
    <h1>{services ? "Tu próximo cliente puede estar cerca." : "Tu próximo comprador puede estar cerca."}</h1><p>{services ? "Iniciá sesión o creá una cuenta para ofrecer tus servicios y administrar tu perfil profesional. No necesitás tener un comercio." : "Iniciá sesión o creá una cuenta para publicar y administrar tus artículos. No necesitás tener un comercio."}</p>
    <div className={styles.actions}><Link className="primary-button" href={loginUrl(returnTo)}>Iniciar sesión</Link>
      <Link className="outline-button" href={`/registro?redirect=${encodeURIComponent(returnTo)}`}>Crear cuenta</Link></div>
    <Link className="secondary-link" href="/publicar">Ver opciones para publicar</Link></section>;
  return <Fragment key={user.id}>{children}</Fragment>;
}

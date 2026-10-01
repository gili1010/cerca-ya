"use client";

import { ChevronDown, MapPin, UserRound } from "lucide-react";
import { useAuth } from "../auth/auth-provider";
import { Brand } from "./brand";
import Link from "next/link";

interface HeaderProps {
  zone: string;
  onZone: () => void;
  onAccount: () => void;
  onExplore: () => void;
  onRequests: () => void;
  onHow: () => void;
}

export function Header({ zone, onZone, onAccount, onExplore, onRequests, onHow }: HeaderProps) {
  const { user, profile, loading } = useAuth();
  const accountLabel = user ? profile?.full_name.trim().split(/\s+/)[0] || "Mi cuenta" : "Iniciar sesión";
  return <header className="site-header" id="inicio">
    <div className="shell header-content">
      <Brand />
      <button className="zone-button" onClick={onZone}>
        <MapPin size={18} /><span><small>Tu ubicación</small><strong>{zone}</strong></span><ChevronDown size={14} />
      </button>
      <nav className="desktop-links" aria-label="Navegación principal">
        <button className="current" onClick={onExplore}>Explorar</button>
        <button onClick={onRequests}>Mis pedidos</button>
        <Link href="/reservas">Mis reservas</Link>
        <Link href="/comercio">Modo comercio</Link>
        <button onClick={onHow}>Cómo funciona</button>
      </nav>
      <button className="login-button" onClick={onAccount} disabled={loading} aria-label={user ? "Mi cuenta" : "Iniciar sesión"}><UserRound size={17} /><span>{accountLabel}</span></button>
    </div>
  </header>;
}

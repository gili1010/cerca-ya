"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { ProfileRow } from "@/types/database";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/auth/profile";

interface AuthValue {
  user: User | null; session: Session | null; profile: ProfileRow | null;
  loading: boolean; profileLoading: boolean; error: string; profileError: string;
  retryProfile: () => void;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileResult, setProfileResult] = useState<{ id: string; profile: ProfileRow | null; error: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const user = session?.user ?? null;

  useEffect(() => {
    let live = true;
    let revision = 0;
    const client = getSupabaseBrowserClient();
    if (!client) { setError("El acceso a cuentas todavía no está configurado."); setLoading(false); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      revision++;
      if (live) { setSession(nextSession); setLoading(false); setError(""); }
      // No awaited Supabase requests inside this callback: avoids the SDK auth lock.
    });
    const initialRevision = revision;
    client.auth.getSession().then(({ data, error: failure }) => {
      if (!live || initialRevision !== revision) return;
      setSession(failure ? null : data.session);
      setLoading(false);
      if (failure) setError("No pudimos recuperar tu sesión. Intentá iniciar sesión nuevamente.");
    }).catch(() => { if (live) { setLoading(false); setError("No pudimos recuperar tu sesión. Revisá tu conexión."); } });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    let live = true;
    ensureProfile(client, user).then(profile => {
      if (live) setProfileResult({ id: user.id, profile, error: "" });
    }).catch(() => {
      if (live) setProfileResult({ id: user.id, profile: null, error: "Tu sesión está activa, pero no pudimos cargar tu perfil. Volvé a intentar." });
    });
    return () => { live = false; };
    // Refresh-token events keep the same ID; the profile is not queried repeatedly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, attempt]);

  const currentProfile = user && profileResult?.id === user.id ? profileResult : null;
  return <AuthContext.Provider value={{ user, session, loading, error, profile: currentProfile?.profile ?? null,
    profileLoading: Boolean(user && !currentProfile), profileError: currentProfile?.error ?? "",
    retryProfile: () => { setProfileResult(null); setAttempt(value => value + 1); },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requires AuthProvider");
  return value;
}

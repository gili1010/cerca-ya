"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "./auth-provider";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./account-suspension.module.css";
export function AccountSuspensionNotice() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [result, setResult] = useState<{ id: string; suspended: boolean } | null>(null);
  useEffect(() => {
    if (!user) return;
    const id = user.id;
    let live = true, revision = 0;
    async function refresh() {
      const current = ++revision;
      try {
        const client = getSupabaseBrowserClient(); if (!client) return;
        const { data, error } = await client.rpc("is_my_account_suspended", {});
        if (live && current === revision && !error) setResult({ id, suspended: data });
      } catch { /* La autorización efectiva siempre se verifica en PostgreSQL. */ }
    }
    function visible() { if (document.visibilityState === "visible") void refresh(); }
    void refresh(); window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    return () => { live = false; window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); };
  }, [user?.id, pathname]);
  return user && result?.id === user.id && result.suspended ? <aside className={styles.notice} role="status"><strong>Tu cuenta está suspendida.</strong><span>Podés consultar tu historial, pero no realizar acciones de marketplace.</span></aside> : null;
}

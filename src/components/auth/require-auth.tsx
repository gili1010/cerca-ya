"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./auth-provider";
import { loginUrl } from "@/lib/auth/redirect";

export function RequireAuth({ children, returnTo }: { children: ReactNode; returnTo: string }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!loading && !user) router.replace(loginUrl(returnTo)); }, [user, loading, router, returnTo]);
  if (loading || !user) return <p className="workflow-loading" role="status">Comprobando tu sesión…</p>;
  return children;
}

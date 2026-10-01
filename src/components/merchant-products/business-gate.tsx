"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { BusinessRow } from "@/types/database";
import { useMyBusiness } from "../businesses/business-provider";
import { FormError } from "../requests/request-common";

export function MerchantBusinessGate({ children }: { children: (business: BusinessRow) => ReactNode }) {
  const { business, loading, error, refresh } = useMyBusiness();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !error && !business) router.replace("/comercio/crear");
  }, [business, loading, error, router]);
  if (loading) return <p className="workflow-loading" role="status">Cargando tu comercio…</p>;
  if (error) return <section className="panel"><FormError message={error} /><button className="outline-button" onClick={() => void refresh().catch(() => {})}>Reintentar</button></section>;
  if (!business) return <p className="workflow-loading" role="status">Abriendo la creación de tu comercio…</p>;
  return children(business);
}

import { personalSearchReturnTo } from "@/lib/search-navigation";
import { provinceByCode } from "@/lib/argentina-provinces";

export interface ServiceSearchContext { returnTo: string; locality: string; province: string; providerPage?: number }

/** Only the known Home explorer is accepted as a return destination. */
export function readServiceSearchContext(params: URLSearchParams): ServiceSearchContext {
  return {
    returnTo: personalSearchReturnTo(params.get("returnTo")),
    locality: (params.get("service_locality") ?? "").trim().slice(0, 120),
    province: provinceByCode(params.get("service_province"))?.code ?? "",
    providerPage: /^\d+$/.test(params.get("provider_page") ?? "") ? Math.min(Number(params.get("provider_page")), 100000) : 0,
  };
}

export function servicePublicHref(kind: "servicio" | "prestador", id: string, context: ServiceSearchContext): string {
  const params = new URLSearchParams({ returnTo: personalSearchReturnTo(context.returnTo) });
  if (context.locality) params.set("service_locality", context.locality);
  if (provinceByCode(context.province)) params.set("service_province", context.province);
  if (context.providerPage) params.set("provider_page", String(context.providerPage));
  return `/${kind}/${encodeURIComponent(id)}?${params}`;
}

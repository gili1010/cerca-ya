import type { ServiceMode, ServicePricingMode, ServiceStatus, ServiceListingInput, OwnedServiceProvider } from "@/types/services";
import { normalizeArgentinaPhone } from "@/lib/phone";
import { isServiceId } from "./contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
export async function assertServiceSession(client: SupabaseClient<Database>, userId: string) {
  const {data,error}=await client.auth.getSession();
  if(error||data.session?.user.id!==userId)throw new Error("Iniciá sesión nuevamente antes de continuar con este servicio.");
}
export const serviceModeLabels: Record<ServiceMode,string> = { ONSITE: "A domicilio o lugar coordinado", AT_PROVIDER: "En el lugar del prestador", REMOTE: "Remoto" };
export const serviceStatusLabels: Record<ServiceStatus,string> = { DRAFT: "Borrador", PUBLISHED: "Publicado", PAUSED: "Pausado", WITHDRAWN: "Retirado" };
export function servicePriceLabel(mode: ServicePricingMode, price: number | null) {
  if (mode === "QUOTE" || price === null) return "A presupuestar";
  return `${mode === "FROM" ? "Desde " : ""}${new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2}).format(price)}`;
}
export function servicePrice(value: string): number | null {
  const normalized=value.trim().replace(",",".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const n=Number(normalized); return Number.isFinite(n)&&n>0&&n<=9999999999.99?n:null;
}
export function providerPublishProblem(provider: OwnedServiceProvider): string {
  if (provider.admin_blocked) return "Tu perfil profesional está bloqueado. No podés publicar servicios.";
  if (!provider.active) return "Activá tu perfil profesional antes de publicar.";
  if (provider.contact_method!=="WHATSAPP" || !normalizeArgentinaPhone(provider.contact_whatsapp) || !provider.contact_consent_at) return "Completá y autorizá tu WhatsApp en Mi perfil profesional.";
  if (!provider.areas.length) return "Agregá al menos una localidad donde trabajás en Mi perfil profesional.";
  return "";
}
export function serviceInputProblem(input: ServiceListingInput): string {
  if (!input.title.trim() || input.title.trim().length>160 || /[\u0000-\u001f]/.test(input.title)) return "Escribí un título válido para el servicio.";
  if (!isServiceId(input.category_id)) return "Elegí una especialidad de servicio.";
  if (input.description.length>5000) return "La descripción admite hasta 5.000 caracteres.";
  if (input.pricing_mode!=="QUOTE" && (input.price===null || !Number.isFinite(input.price) || input.price<=0 || input.price>9999999999.99 || Math.abs(input.price*100-Math.round(input.price*100))>0.0001)) return "Indicá un precio positivo, con hasta dos decimales.";
  return "";
}
/** No mostrar errores técnicos/URLs/credenciales devueltos por fetch o SDK. */
export function serviceUiError(error: unknown, fallback="No pudimos completar la operación. Volvé a cargar antes de reintentar.") {
  if (!(error instanceof Error)) return fallback;
  const message=error.message;
  return /^(No pudimos|Revisá|Elegí|Indicá|Volvé a|La información cambió|Este |Tu cuenta|Alcanzaste|Ya tenés|Completá|Iniciá|No podés|Podés declarar|La publicación cambió)/.test(message) && message.length<300 && !/(https?:|token|SQL|Postgres|Supabase|fetch)/i.test(message)?message:fallback;
}
export function serviceSessionId(kind: "provider"|"listing",userId:string): string|null {
  try {const id=sessionStorage.getItem(`cercaya.services.${kind}.${userId}`); return isServiceId(id)?id:null;} catch{return null;}
}
export function rememberServiceId(kind:"provider"|"listing",userId:string,id:string|null) {
  try {const key=`cercaya.services.${kind}.${userId}`; if(id)sessionStorage.setItem(key,id);else sessionStorage.removeItem(key);}catch{/* El UUID también sigue en memoria. */}
}


import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { loginUrl } from "@/lib/auth/redirect";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  const protectedPage = ["/cuenta", "/guardados", "/comercio/crear", "/comercio/editar", "/comercio/mi-negocio", "/pedido/nuevo"].includes(path)
    || path === "/comercio/productos" || path.startsWith("/comercio/productos/")
    || path === "/pedidos" || /^\/pedido\/[^/]+(?:\/confirmacion)?\/?$/.test(path)
    || /^\/pedido\/[^/]+\/oferta\/[^/]+\/?$/.test(path)
    || path === "/comercio/radar" || path === "/comercio/oportunidades" || path.startsWith("/comercio/oportunidades/") || path.startsWith("/comercio/oferta-enviada/")
    || path === "/reservas" || path === "/comercio/reservas" || /^\/(?:comercio\/)?reserva\/[^/]+(?:\/confirmacion)?\/?$/.test(path)
    || /^\/producto\/[^/]+\/reservar\/?$/.test(path);
  const config = getSupabaseConfig();
  let authenticated = false;
  if (config) {
    const client = createServerClient<Database>(config.url, config.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          const previous = response;
          response = NextResponse.next({ request });
          previous.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    });
    try {
      const { data, error } = await client.auth.getClaims();
      authenticated = !error && Boolean(data?.claims.sub);
    } catch { /* Public pages remain accessible when Auth cannot be reached. */ }
  }
  if (protectedPage && !authenticated) {
    const target = loginUrl(`${path}${request.nextUrl.search}`);
    const redirected = NextResponse.redirect(new URL(target, request.url));
    response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
    response = redirected;
  }
  // Auth responses/cookies must never be cached by a CDN or shared proxy.
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"] };

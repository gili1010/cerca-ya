import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const google = params.get("flow") === "google";
  const recovery = params.get("type") === "recovery" || params.get("flow") === "recovery";
  const target = safeRedirect(params.get("next") ?? params.get("redirect"), recovery ? "/restablecer-clave" : "/cuenta");
  let confirmed = false;
  try {
    const client = await createSupabaseServerClient();
    const token_hash = params.get("token_hash");
    const type = params.get("type");
    const code = params.get("code");
    if (client && !params.has("error") && token_hash && (recovery ? type === "recovery" : type === "email" || type === "signup")) {
      const { data, error } = await client.auth.verifyOtp({ token_hash, type });
      confirmed = !error && Boolean(data.session);
    } else if (client && !params.has("error") && code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      confirmed = !error && Boolean(data.session) && (!recovery || data.redirectType === "recovery");
    }
  } catch { /* Show a short message; never expose the code, tokens or provider details. */ }
  const destination = recovery ? confirmed ? target : "/restablecer-clave?error=invalid" : confirmed ? target : `/login?error=${google ? "oauth" : "confirmation"}&redirect=${encodeURIComponent(target)}`;
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

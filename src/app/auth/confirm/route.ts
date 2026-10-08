import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/redirect";

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value === "signup" || value === "email" || value === "recovery"
    || value === "invite" || value === "magiclink" || value === "email_change";
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const google = params.get("flow") === "google";
  const recovery = (isEmailOtpType(type) && type === "recovery") || params.get("flow") === "recovery";
  const target = safeRedirect(params.get("next") ?? params.get("redirect"), recovery ? "/restablecer-clave" : "/cuenta");
  let confirmed = false;
  try {
    const client = await createSupabaseServerClient();
    const token_hash = params.get("token_hash");
    const code = params.get("code");
    if (client && !params.has("error") && token_hash && isEmailOtpType(type) && (!recovery || type === "recovery")) {
      const { data, error } = await client.auth.verifyOtp({ token_hash, type });
      confirmed = !error && Boolean(data.session);
    } else if (client && !params.has("error") && !token_hash && !recovery && code) {
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      confirmed = !error && Boolean(data.session);
    }
  } catch { /* Show a short message; never expose the code, tokens or provider details. */ }
  const destination = recovery ? confirmed ? target : "/restablecer-clave?error=invalid" : confirmed ? target : `/login?error=${google ? "oauth" : "confirmation"}&redirect=${encodeURIComponent(target)}`;
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

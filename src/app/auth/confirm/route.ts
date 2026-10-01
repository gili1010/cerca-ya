import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeRedirect } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = safeRedirect(params.get("redirect"));
  const client = await createSupabaseServerClient();
  let confirmed = false;
  try {
    const token_hash = params.get("token_hash");
    const type = params.get("type");
    const code = params.get("code");
    if (client && token_hash && (type === "email" || type === "signup")) {
      const { error } = await client.auth.verifyOtp({ token_hash, type });
      confirmed = !error;
    } else if (client && code) {
      const { error } = await client.auth.exchangeCodeForSession(code);
      confirmed = !error;
    }
  } catch { /* Show a short message; never expose the code, tokens or provider details. */ }
  const destination = confirmed ? target : `/login?error=confirmation&redirect=${encodeURIComponent(target)}`;
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

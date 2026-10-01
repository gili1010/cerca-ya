import { DetailShell } from "@/components/details/detail-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirect } from "@/lib/auth/redirect";
export const metadata = { title: "Iniciar sesión | CercaYa" };
export default async function Page({ searchParams }: { searchParams: Promise<{ redirect?: string | string[]; error?: string }> }) {
  const params = await searchParams;
  return <DetailShell><AuthForm mode="login" returnTo={safeRedirect(params.redirect)} confirmationError={params.error === "confirmation"} oauthError={params.error === "oauth"} /></DetailShell>;
}

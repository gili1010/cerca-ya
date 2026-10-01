import { DetailShell } from "@/components/details/detail-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { safeRedirect } from "@/lib/auth/redirect";
export const metadata = { title: "Crear cuenta | CercaYa" };
export default async function Page({ searchParams }: { searchParams: Promise<{ redirect?: string | string[] }> }) {
  const { redirect } = await searchParams;
  return <DetailShell><AuthForm mode="signup" returnTo={safeRedirect(redirect)} /></DetailShell>;
}

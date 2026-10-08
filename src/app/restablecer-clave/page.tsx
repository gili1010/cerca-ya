import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { DetailShell } from "@/components/details/detail-shell";
import { PasswordSupport } from "@/components/support/password-support";
export const metadata: Metadata = { title: "Nueva contraseña | CercaYa", referrer: "no-referrer" };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  if (typeof params.code === "string" && !params.error) redirect(`/auth/confirm?flow=recovery&code=${encodeURIComponent(params.code)}`);
  if (typeof params.token_hash === "string" && params.type === "recovery" && !params.error) redirect(`/auth/confirm?flow=recovery&type=recovery&token_hash=${encodeURIComponent(params.token_hash)}`);
  return <DetailShell><PasswordSupport reset invalid={Boolean(params.error)} /></DetailShell>;
}

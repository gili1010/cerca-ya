import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginUrl } from "./redirect";

export const getAuthenticatedUser = cache(async () => {
  const client = await createSupabaseServerClient();
  if (!client) return null;
  try {
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user;
  } catch { return null; }
});

export async function requireUser(returnTo: string) {
  const user = await getAuthenticatedUser();
  if (!user) redirect(loginUrl(returnTo));
  return user;
}

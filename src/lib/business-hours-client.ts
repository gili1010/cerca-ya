import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BusinessHoursSchedule } from "./business-hours";
export async function readBusinessHours(client: SupabaseClient<Database>, businessId: string): Promise<BusinessHoursSchedule> {
  const { data, error } = await client.rpc("read_business_hours", { p_business_id: businessId });
  if (error) throw error;
  const result = data as unknown as BusinessHoursSchedule | null;
  if (!result || typeof result.configured !== "boolean" || !Array.isArray(result.periods)) throw new Error("hours_unavailable");
  return result;
}

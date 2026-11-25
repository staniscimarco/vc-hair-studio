import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isServiceRoleConfigured, supabaseServiceRoleKey, supabaseUrl } from "@/lib/supabase/env";

export function createAdminSupabase(): SupabaseClient | null {
  const url = supabaseUrl();
  const key = supabaseServiceRoleKey();
  if (!url || !key || !isServiceRoleConfigured()) return null;
  return createClient(
    url,
    key,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

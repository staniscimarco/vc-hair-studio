import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

/** Id dei profili amministratore: le loro schede cliente non compaiono mai tra i clienti. */
export async function adminProfileIds(admin: Admin): Promise<string[]> {
  const { data } = await admin.from("profiles").select("id").eq("role", "admin");
  return (data ?? []).map((row) => String(row.id));
}

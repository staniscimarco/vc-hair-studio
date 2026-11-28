import "server-only";
import { formatTime } from "@/lib/format";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { notifyCustomerProfile } from "@/lib/server/notices";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

/**
 * Promemoria push alle clienti circa un'ora prima dell'appuntamento.
 * Il controllo gira ogni 15 minuti: prende gli appuntamenti confermati che iniziano tra 45 e 75 minuti
 * e manda la notifica una sola volta (reminder_push_at).
 */
export async function sendHourReminders(admin: Admin, now = new Date()) {
  const from = new Date(now.getTime() + 45 * 60_000).toISOString();
  const to = new Date(now.getTime() + 75 * 60_000).toISOString();
  const { data, error } = await admin
    .from("appointments")
    .select("id, starts_at, customers(profile_id, first_name), services(name)")
    .eq("status", "confirmed")
    .is("reminder_push_at", null)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .limit(50);
  if (error) return { inviati: 0, motivo: error.message };
  let sent = 0;
  for (const row of data ?? []) {
    const claimed = await admin
      .from("appointments")
      .update({ reminder_push_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("reminder_push_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed.data) continue;
    const customer = (Array.isArray(row.customers) ? row.customers[0] : row.customers) as { profile_id?: string | null; first_name?: string } | null;
    const service = (Array.isArray(row.services) ? row.services[0] : row.services) as { name?: string } | null;
    if (!customer?.profile_id) continue;
    await notifyCustomerProfile(
      customer.profile_id,
      {
        title: "Tra un'ora ci vediamo ✨",
        body: `${customer.first_name ? `${customer.first_name}, ` : ""}ti ricordiamo ${service?.name ?? "il tuo appuntamento"} alle ${formatTime(new Date(row.starts_at))}. A tra poco!`,
        url: "/i-miei-appuntamenti",
      },
      String(row.id),
    );
    sent += 1;
  }
  return { inviati: sent };
}

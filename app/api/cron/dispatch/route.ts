import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDateLong, formatTime } from "@/lib/format";
import { ensureDatabase } from "@/lib/server/schema";
import { dailyAvailabilityBroadcast } from "@/lib/server/daily";
import { dispatchEmail, dispatchPush } from "@/lib/server/dispatch";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ errore: "Non autorizzato" }, { status: 401 });
  }
  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ saltato: true, motivo: "Archivio non configurato." });
  await ensureDatabase().catch(() => undefined);
  const push = await dispatchPush(admin);
  const email = await dispatchEmail(admin);
  const reminders = await queueReminders(admin);
  const giornaliero = await dailyAvailabilityBroadcast(admin).catch((error: unknown) => ({
    inviata: false,
    motivo: error instanceof Error ? error.message : "errore",
  }));
  return NextResponse.json({ push, email, reminders, giornaliero });
}

async function queueReminders(admin: NonNullable<ReturnType<typeof createAdminSupabase>>) {
  const settings = await admin.from("salon_settings").select("reminders_enabled, reminder_hours_before").eq("id", 1).single();
  if (!settings.data?.reminders_enabled) return { accodati: 0 };
  const hours = Number(settings.data.reminder_hours_before ?? 24);
  const from = new Date();
  const to = new Date(Date.now() + hours * 3600_000);
  const { data } = await admin.from("appointments").select("id, starts_at, customers(email), services(name)").eq("status", "confirmed").gte("starts_at", from.toISOString()).lte("starts_at", to.toISOString());
  let queued = 0;
  for (const row of data ?? []) {
    const customer = row.customers as { email?: string } | { email?: string }[] | null;
    const email = Array.isArray(customer) ? customer[0]?.email : customer?.email;
    if (!email) continue;
    const when = new Date(row.starts_at);
    if (when.getTime() - Date.now() > hours * 3600_000) continue;
    const { error } = await admin.from("email_logs").insert({
      appointment_id: row.id,
      kind: "reminder",
      to_email: email,
      subject: `Promemoria appuntamento ${formatDateLong(when)} alle ${formatTime(when)}`,
      status: "pending",
      dedupe_key: `reminder:${row.id}`,
    });
    if (!error) queued += 1;
  }
  return { accodati: queued };
}

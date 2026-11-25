import { NextResponse } from "next/server";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDateLong, formatTime } from "@/lib/format";
import { ensureDatabase } from "@/lib/server/schema";
import { dailyAvailabilityBroadcast } from "@/lib/server/daily";
import { subscriptionsFor } from "@/lib/server/push";

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

async function dispatchPush(admin: NonNullable<ReturnType<typeof createAdminSupabase>>) {
  const ready = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
  const { data } = await admin.from("notification_outbox").select("*").eq("status", "pending").lte("next_attempt_at", new Date().toISOString()).limit(20);
  if (!ready) {
    if (data?.length) await admin.from("notification_outbox").update({ status: "skipped", last_error: "Chiavi non configurate." }).in("id", data.map((row) => row.id));
    return { inviate: 0, motivo: "non_configurato" };
  }
  setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  // Le notifiche delle prenotazioni vanno solo ai dispositivi dell'amministratrice, mai alle clienti.
  const devices = { data: await subscriptionsFor(admin, "admin") };
  let sent = 0;
  for (const item of data ?? []) {
    let ok = false;
    for (const device of devices.data ?? []) {
      try {
        await sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth_key } }, JSON.stringify(item.payload));
        ok = true;
      } catch (error) {
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (status === 404 || status === 410) await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
    const attempts = Number(item.attempts) + 1;
    await admin.from("notification_outbox").update(ok || !(devices.data ?? []).length
      ? { status: ok ? "sent" : "skipped", sent_at: ok ? new Date().toISOString() : null, attempts }
      : { attempts, next_attempt_at: new Date(Date.now() + attempts * 15 * 60_000).toISOString(), status: attempts >= 5 ? "failed" : "pending" }).eq("id", item.id);
    if (ok) sent += 1;
  }
  return { inviate: sent };
}

async function dispatchEmail(admin: NonNullable<ReturnType<typeof createAdminSupabase>>) {
  const { data } = await admin.from("email_logs").select("*").eq("status", "pending").limit(20);
  const configured = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
  if (!configured) {
    if (data?.length) await admin.from("email_logs").update({ status: "not_configured", error: "Provider e-mail non configurato." }).in("id", data.map((row) => row.id));
    return { inviate: 0, motivo: "non_configurato" };
  }
  let sent = 0;
  for (const item of data ?? []) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: item.to_email,
        subject: item.subject,
        html: `<p>${item.subject}</p><p>Apri VC Hair Studio per i dettagli. Il pagamento si effettua in salone.</p>`,
      }),
    });
    if (response.ok) {
      const payload = await response.json();
      await admin.from("email_logs").update({ status: "sent", sent_at: new Date().toISOString(), provider_id: payload.id ?? null }).eq("id", item.id);
      sent += 1;
    } else {
      await admin.from("email_logs").update({ status: "failed", error: `HTTP ${response.status}` }).eq("id", item.id);
    }
  }
  return { inviate: sent };
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

import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { pushReady, sendToSubscriptions, subscriptionsFor } from "@/lib/server/push";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

/** Invia subito le notifiche all'amministratrice in coda (le nuove prenotazioni). */
export async function dispatchPush(admin: Admin) {
  const { data } = await admin.from("notification_outbox").select("*").eq("status", "pending").lte("next_attempt_at", new Date().toISOString()).limit(20);
  if (!pushReady()) {
    if (data?.length) await admin.from("notification_outbox").update({ status: "skipped", last_error: "Chiavi non configurate." }).in("id", data.map((row) => row.id));
    return { inviate: 0, motivo: "non_configurato" };
  }
  // Le notifiche delle prenotazioni vanno solo ai dispositivi dell'amministratrice, mai alle clienti.
  const devices = await subscriptionsFor(admin, "admin");
  let sent = 0;
  for (const item of data ?? []) {
    const ok = (await sendToSubscriptions(admin, devices, item.payload)) > 0;
    const attempts = Number(item.attempts) + 1;
    await admin.from("notification_outbox").update(ok || !devices.length
      ? { status: ok ? "sent" : "skipped", sent_at: ok ? new Date().toISOString() : null, attempts }
      : { attempts, next_attempt_at: new Date(Date.now() + attempts * 15 * 60_000).toISOString(), status: attempts >= 5 ? "failed" : "pending" }).eq("id", item.id);
    if (ok) sent += 1;
  }
  return { inviate: sent };
}

/** Invia le e-mail in coda (conferme, esiti, promemoria). */
export async function dispatchEmail(admin: Admin) {
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


/** Da chiamare subito dopo aver messo in coda: nessuna attesa del controllo orario. */
export async function dispatchNow() {
  const admin = createAdminSupabase();
  if (!admin) return;
  try {
    await Promise.all([dispatchPush(admin), dispatchEmail(admin)]);
  } catch (error) {
    console.error("invio-immediato", error);
  }
}

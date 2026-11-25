import "server-only";
import { sendNotification, setVapidDetails } from "web-push";
import { createAdminSupabase } from "@/lib/supabase/admin";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;
type Subscription = { id: string; endpoint: string; p256dh: string; auth_key: string };
export type Payload = { title: string; body: string; url: string };

export function pushReady() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

function configure() {
  setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
}

/** Dispositivi attivi dei profili con il ruolo indicato. */
export async function subscriptionsFor(admin: Admin, role: "admin" | "customer"): Promise<Subscription[]> {
  const profiles = await admin.from("profiles").select("id").eq("role", role);
  const ids = (profiles.data ?? []).map((row) => row.id as string);
  const found: Subscription[] = [];
  if (role === "customer") {
    // Dispositivi di chi ha installato l'app senza accedere: ricevono posti liberi e offerte.
    const anonymous = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").is("profile_id", null).is("disabled_at", null);
    found.push(...((anonymous.data ?? []) as Subscription[]));
  }
  for (let index = 0; index < ids.length; index += 200) {
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .in("profile_id", ids.slice(index, index + 200))
      .is("disabled_at", null);
    found.push(...((data ?? []) as Subscription[]));
  }
  return found;
}

/** Invia a un elenco di dispositivi; disattiva quelli non più validi. Restituisce quanti l'hanno ricevuta. */
export async function sendToSubscriptions(admin: Admin, devices: Subscription[], payload: Payload) {
  if (!pushReady() || !devices.length) return 0;
  configure();
  let sent = 0;
  for (const device of devices) {
    try {
      await sendNotification({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth_key } }, JSON.stringify(payload));
      sent += 1;
      await admin.from("push_subscriptions").update({ last_success_at: new Date().toISOString(), fail_count: 0 }).eq("id", device.id);
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").update({ disabled_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
  }
  return sent;
}

/**
 * Invio a tutte le clienti iscritte. Con `dedupeKey` lo stesso messaggio non parte due volte
 * (usato per l'invio automatico giornaliero).
 */
export async function broadcastToCustomers(
  admin: Admin,
  input: Payload & { kind: "manuale" | "disponibilita" | "promozione"; dedupeKey?: string },
) {
  if (!pushReady()) return { inviata: false, motivo: "Le chiavi delle notifiche non sono configurate.", destinatari: 0, ricevute: 0 };
  const devices = await subscriptionsFor(admin, "customer");
  const row = await admin
    .from("broadcasts")
    .insert({
      kind: input.kind,
      title: input.title,
      body: input.body,
      url: input.url,
      recipients: devices.length,
      dedupe_key: input.dedupeKey ?? null,
    })
    .select("id")
    .single();
  if (row.error || !row.data) {
    if (row.error?.code === "23505") return { inviata: false, motivo: "Già inviata oggi.", destinatari: 0, ricevute: 0 };
    return { inviata: false, motivo: "Non è stato possibile registrare l'invio.", destinatari: 0, ricevute: 0 };
  }
  const sent = await sendToSubscriptions(admin, devices, { title: input.title, body: input.body, url: input.url });
  await admin.from("broadcasts").update({ sent }).eq("id", row.data.id);
  return { inviata: sent > 0, destinatari: devices.length, ricevute: sent, motivo: devices.length ? undefined : "Nessuna cliente ha ancora attivato le notifiche." };
}

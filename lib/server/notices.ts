import "server-only";
import { buildPushPayload, type PushEvent } from "@/lib/notifications/message";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDate, formatDateLong, formatTime } from "@/lib/format";
import { sendToSubscriptions } from "@/lib/server/push";
import { dispatchNow } from "@/lib/server/dispatch";
import { HttpError } from "@/lib/http";

export async function enqueueAppointmentNotice(input: {
  appointmentId: string;
  event: PushEvent;
  when: Date;
  email?: string | null;
  serviceName: string;
  code: string;
  /** Prenotazione online in attesa di approvazione. */
  pending?: boolean;
  /** false per gli appuntamenti inseriti dal salone: niente notifica all'amministratrice. */
  push?: boolean;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;

  // All'amministratrice arriva solo la notifica delle nuove prenotazioni fatte online.
  if (input.event === "created" && input.push !== false) {
    const payload = buildPushPayload(input.event, input.when, input.appointmentId, {
      pending: input.pending,
      serviceName: input.serviceName,
    });
    const { data: notification, error } = await admin
      .from("notifications")
      .insert({
        appointment_id: input.appointmentId,
        event: input.event,
        title: payload.title,
        body: payload.body,
        url: payload.url,
      })
      .select("id")
      .single();
    if (error || !notification) console.error(error);
    else {
      await admin.from("notification_outbox").insert({
        notification_id: notification.id,
        appointment_id: input.appointmentId,
        payload: { ...payload, tag: `richiesta-${input.appointmentId}` },
        status: "pending",
      });
    }
  }

  if (!input.email) {
    await dispatchNow();
    return;
  }
  const subjects: Record<PushEvent, string> = {
    created: input.pending ? "Abbiamo ricevuto la tua richiesta di appuntamento" : "Il tuo appuntamento è confermato",
    updated: "Il tuo appuntamento è stato modificato",
    cancelled: "Il tuo appuntamento è stato annullato",
  };
  await admin.from("email_logs").insert({
    appointment_id: input.appointmentId,
    kind: input.event,
    to_email: input.email,
    subject: subjects[input.event],
    status: "pending",
    dedupe_key: `${input.event}:${input.appointmentId}:${input.when.toISOString()}`,
  });
  // Invio subito: il controllo orario resta solo come nuovo tentativo in caso di errore.
  await dispatchNow();
}

/** Avvisa la cliente (push sui suoi dispositivi + e-mail) dell'esito della richiesta. */
export async function notifyCustomerDecision(input: {
  appointmentId: string;
  accepted: boolean;
  when: Date;
  profileId: string | null;
  email: string | null;
  serviceName: string;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;
  const quando = `${formatDateLong(input.when)} alle ${formatTime(input.when)}`;
  const payload = input.accepted
    ? {
        title: "Appuntamento confermato ✨",
        body: `${input.serviceName}, ${quando}. Ti aspettiamo in salone!`,
        url: "/i-miei-appuntamenti",
      }
    : {
        title: "Orario non disponibile",
        body: `Ci dispiace, non possiamo accoglierti ${quando}. Scegli un altro orario: ti aspettiamo!`,
        url: "/prenota",
      };
  if (input.profileId) {
    // Resta nel centro notifiche della cliente, con il contatore delle non lette.
    await admin.from("customer_notifications").insert({
      profile_id: input.profileId,
      appointment_id: input.appointmentId,
      title: payload.title,
      body: payload.body,
      url: payload.url,
    });
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("profile_id", input.profileId)
      .is("disabled_at", null);
    await sendToSubscriptions(admin, data ?? [], { ...payload, tag: `esito-${input.appointmentId}` });
  }
  if (input.email) {
    await admin.from("email_logs").insert({
      appointment_id: input.appointmentId,
      kind: input.accepted ? "accettata" : "rifiutata",
      to_email: input.email,
      subject: input.accepted ? `Appuntamento confermato: ${quando}` : "La tua richiesta di appuntamento non è stata accettata",
      status: "pending",
      dedupe_key: `${input.accepted ? "accettata" : "rifiutata"}:${input.appointmentId}`,
    });
    await dispatchNow();
  }
}

/** Messaggio alla cliente di un appuntamento: resta nel suo centro notifiche e arriva come push. */
export async function notifyCustomerByAppointment(appointmentId: string, payload: { title: string; body: string; url: string }) {
  const admin = createAdminSupabase();
  if (!admin) return;
  const { data } = await admin.from("appointments").select("customers(profile_id)").eq("id", appointmentId).maybeSingle();
  const customer = data ? ((Array.isArray(data.customers) ? data.customers[0] : data.customers) as { profile_id?: string | null } | null) : null;
  if (!customer?.profile_id) return;
  await admin.from("customer_notifications").insert({ profile_id: customer.profile_id, appointment_id: appointmentId, ...payload });
  const devices = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth_key").eq("profile_id", customer.profile_id).is("disabled_at", null);
  await sendToSubscriptions(admin, devices.data ?? [], { ...payload, tag: `appuntamento-${appointmentId}` });
}

export function appointmentSummary(serviceName: string, when: Date, code: string): string {
  return `${serviceName} · ${formatDate(when)} alle ${formatTime(when)} · ${code}`;
}

export async function limitRequests(bucket: string, limit: number) {
  const admin = createAdminSupabase();
  if (!admin) return;
  const windowStart = new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString();
  const { data } = await admin
    .from("rate_limits")
    .select("count")
    .eq("bucket", bucket)
    .eq("window_start", windowStart)
    .maybeSingle();
  const count = Number(data?.count ?? 0);
  if (count >= limit) {
    throw new HttpError(429, "Hai effettuato troppe richieste. Attendi qualche minuto e riprova.");
  }
  await admin.from("rate_limits").upsert({
    bucket,
    window_start: windowStart,
    count: count + 1,
  });
}

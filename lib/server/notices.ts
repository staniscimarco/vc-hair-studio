import "server-only";
import { buildPushPayload, type PushEvent } from "@/lib/notifications/message";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDate, formatDateLong, formatTime } from "@/lib/format";
import { sendToSubscriptions } from "@/lib/server/push";
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
        payload,
        status: "pending",
      });
    }
  }

  if (!input.email) return;
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
    const { data } = await admin
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .eq("profile_id", input.profileId)
      .is("disabled_at", null);
    await sendToSubscriptions(admin, data ?? [], payload);
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
  }
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

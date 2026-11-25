import "server-only";
import { buildPushPayload, type PushEvent } from "@/lib/notifications/message";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/format";
import { HttpError } from "@/lib/http";

export async function enqueueAppointmentNotice(input: {
  appointmentId: string;
  event: PushEvent;
  when: Date;
  email?: string | null;
  serviceName: string;
  code: string;
}) {
  const admin = createAdminSupabase();
  if (!admin) return;
  const payload = buildPushPayload(input.event, input.when, input.appointmentId);
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
  if (error || !notification) {
    console.error(error);
    return;
  }
  await admin.from("notification_outbox").insert({
    notification_id: notification.id,
    appointment_id: input.appointmentId,
    payload,
    status: "pending",
  });

  if (!input.email) return;
  const subjects: Record<PushEvent, string> = {
    created: "Il tuo appuntamento è confermato",
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

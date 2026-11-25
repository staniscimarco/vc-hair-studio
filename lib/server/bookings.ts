import "server-only";
import { bookingCode, HttpError } from "@/lib/http";
import { canCustomerModify } from "@/lib/permissions";
import { romeDate } from "@/lib/availability/time";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { assertSlotFree, loadService, loadSettings, type ServiceRecord } from "@/lib/server/schedule";
import { enqueueAppointmentNotice } from "@/lib/server/notices";

function db() {
  const client = createAdminSupabase();
  if (!client) throw new HttpError(503, "Il salone non è ancora collegato all'archivio.");
  return client;
}

function taken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23P01" || /occupancy|exclusion|orario_occupato/i.test(error.message ?? "");
}

export async function customerForUser(userId: string) {
  const { data, error } = await db()
    .from("customers")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error || !data) throw new HttpError(404, "Non troviamo la tua scheda cliente.");
  return data;
}

async function insertAppointment(row: Record<string, unknown>) {
  const client = db();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = bookingCode();
    const { data, error } = await client
      .from("appointments")
      .insert({ ...row, code })
      .select("id, code, calendar_token, starts_at, ends_at, price_cents, status")
      .single();
    if (!error && data) return data;
    if (error?.code === "23505" && String(error.message).includes("idempotency_key") && row.idempotency_key) {
      const existing = await client
        .from("appointments")
        .select("id, code, calendar_token, starts_at, ends_at, price_cents, status")
        .eq("idempotency_key", row.idempotency_key)
        .single();
      if (existing.data) return { ...existing.data, duplicate: true };
    }
    if (error?.code === "23505" && String(error.message).includes("code")) continue;
    if (taken(error)) {
      throw new HttpError(409, "Questo orario è appena stato prenotato. Ti invitiamo a sceglierne un altro.");
    }
    console.error(error);
    throw new HttpError(500, "Non è stato possibile confermare l'appuntamento.");
  }
  throw new HttpError(500, "Non è stato possibile generare il codice della prenotazione.");
}

export async function createOnlineBooking(input: {
  userId: string;
  serviceId: string;
  startIso: string;
  idempotencyKey: string;
}) {
  const settings = await loadSettings();
  if (!settings.bookingEnabled) {
    throw new HttpError(403, "Le prenotazioni online non sono ancora attive.");
  }
  const client = db();
  const existing = await client
    .from("appointments")
    .select("id, code, calendar_token, starts_at, ends_at, price_cents, status")
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (existing.data) return { ...existing.data, duplicate: true };

  const service = await loadService(input.serviceId);
  if (!service.visible) throw new HttpError(404, "Il trattamento selezionato non è disponibile.");
  const start = new Date(input.startIso);
  if (Number.isNaN(start.getTime())) throw new HttpError(400, "L'orario indicato non è valido.");
  await assertSlotFree({ service, start });
  const customer = await customerForUser(input.userId);
  const saved = await insertAppointment({
    customer_id: customer.id,
    service_id: service.id,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + service.durationMinutes * 60_000).toISOString(),
    prep_minutes: service.prepMinutes,
    buffer_minutes: service.bufferMinutes,
    price_cents: service.priceCents,
    source: "online",
    idempotency_key: input.idempotencyKey,
    created_by: input.userId,
    status: "confirmed",
  });
  if (!("duplicate" in saved)) {
    await enqueueAppointmentNotice({
      appointmentId: saved.id,
      event: "created",
      when: start,
      email: customer.email,
      serviceName: service.name,
      code: saved.code,
    });
  }
  return { ...saved, servizio: service.name, data: romeDate(start) };
}

export async function createManualBooking(input: {
  actorId: string;
  customerId: string;
  service: ServiceRecord;
  start: Date;
  durationMinutes: number;
  priceCents: number | null;
  notes?: string;
}) {
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);
  await assertSlotFree({
    service: { ...input.service, durationMinutes: input.durationMinutes },
    start: input.start,
    staff: true,
  });
  const customer = await db().from("customers").select("email").eq("id", input.customerId).single();
  const saved = await insertAppointment({
    customer_id: input.customerId,
    service_id: input.service.id,
    starts_at: input.start.toISOString(),
    ends_at: end.toISOString(),
    prep_minutes: input.service.prepMinutes,
    buffer_minutes: input.service.bufferMinutes,
    price_cents: input.priceCents,
    source: "manuale",
    notes: input.notes ?? null,
    created_by: input.actorId,
    status: "confirmed",
  });
  await enqueueAppointmentNotice({
    appointmentId: saved.id,
    event: "created",
    when: input.start,
    email: customer.data?.email,
    serviceName: input.service.name,
    code: saved.code,
  });
  return saved;
}

async function ownedAppointment(userId: string, appointmentId: string) {
  const customer = await customerForUser(userId);
  const { data, error } = await db()
    .from("appointments")
    .select("*, services(name)")
    .eq("id", appointmentId)
    .eq("customer_id", customer.id)
    .maybeSingle();
  if (error || !data) throw new HttpError(404, "Appuntamento non trovato.");
  return { customer, appointment: data };
}

export async function cancelAppointment(input: {
  appointmentId: string;
  actorId: string;
  asStaff?: boolean;
  reason?: string;
  userId?: string;
}) {
  const client = db();
  const settings = await loadSettings();
  let row: { id: string; starts_at: string; status: string; customer_id: string; services?: { name?: string } };
  let email: string | null = null;
  if (input.asStaff) {
    const result = await client.from("appointments").select("*, services(name), customers(email)").eq("id", input.appointmentId).single();
    if (result.error || !result.data) throw new HttpError(404, "Appuntamento non trovato.");
    row = result.data;
    email = result.data.customers?.email ?? null;
  } else {
    const owned = await ownedAppointment(input.userId!, input.appointmentId);
    row = owned.appointment;
    email = owned.customer.email;
    if (row.status === "cancelled") return row;
    if (!canCustomerModify(new Date(row.starts_at), new Date(), settings.cancelMinHours)) {
      throw new HttpError(403, `Puoi annullare fino a ${settings.cancelMinHours} ore prima dell'appuntamento.`);
    }
  }
  if (row.status === "cancelled") return row;
  const { error } = await client
    .from("appointments")
    .update({ status: "cancelled", cancel_reason: input.reason ?? null })
    .eq("id", row.id);
  if (error) throw new HttpError(500, "Non è stato possibile annullare l'appuntamento.");
  await enqueueAppointmentNotice({
    appointmentId: row.id,
    event: "cancelled",
    when: new Date(row.starts_at),
    email,
    serviceName: row.services?.name ?? "Trattamento",
    code: "",
  });
  return { id: row.id, status: "cancelled" };
}

export async function rescheduleAppointment(input: {
  appointmentId: string;
  userId?: string;
  actorId: string;
  start: Date;
  asStaff?: boolean;
}) {
  const client = db();
  const settings = await loadSettings();
  const result = input.asStaff
    ? await client.from("appointments").select("*, services(*), customers(email)").eq("id", input.appointmentId).single()
    : await client
        .from("appointments")
        .select("*, services(*), customers!inner(email, profile_id)")
        .eq("id", input.appointmentId)
        .eq("customers.profile_id", input.userId)
        .single();
  if (result.error || !result.data) throw new HttpError(404, "Appuntamento non trovato.");
  const row = result.data;
  if (row.status === "cancelled") throw new HttpError(409, "Questo appuntamento risulta annullato.");
  if (!input.asStaff && !canCustomerModify(new Date(row.starts_at), new Date(), settings.rescheduleMinHours)) {
    throw new HttpError(403, `Puoi modificare l'appuntamento fino a ${settings.rescheduleMinHours} ore prima.`);
  }
  const service = {
    id: row.service_id,
    name: row.services.name,
    description: row.services.description,
    durationMinutes: Math.round((new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60_000),
    prepMinutes: row.prep_minutes,
    bufferMinutes: row.buffer_minutes,
    priceCents: row.price_cents,
    color: row.services.color,
    active: true,
    visible: true,
    sortOrder: 0,
  } satisfies ServiceRecord;
  await assertSlotFree({ service, start: input.start, staff: input.asStaff, ignoreAppointmentId: row.id });
  const ends = new Date(input.start.getTime() + service.durationMinutes * 60_000);
  const { error } = await client
    .from("appointments")
    .update({ starts_at: input.start.toISOString(), ends_at: ends.toISOString() })
    .eq("id", row.id);
  if (taken(error)) {
    throw new HttpError(409, "Questo orario è appena stato prenotato. Ti invitiamo a sceglierne un altro.");
  }
  if (error) throw new HttpError(500, "Non è stato possibile spostare l'appuntamento.");
  await enqueueAppointmentNotice({
    appointmentId: row.id,
    event: "updated",
    when: input.start,
    email: row.customers?.email,
    serviceName: service.name,
    code: row.code,
  });
  return { id: row.id, starts_at: input.start.toISOString(), ends_at: ends.toISOString() };
}

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAvailableSlots,
  conflictsWithAppointments,
  type AvailabilityInput,
  type BusyAppointment,
  type ScheduleException,
  type ScheduleRule,
  type WorkingWindow,
} from "@/lib/availability/engine";
import { addDays, eachDate, monthBounds, romeDate, zonedDateTime, type IsoDate } from "@/lib/availability/time";
import { HttpError } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";

export type SalonSettings = {
  salonName: string;
  stylistName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  postalCode: string;
  bookingEnabled: boolean;
  setupCompleted: boolean;
  slotMinutes: number;
  minAdvanceMinutes: number;
  maxHorizonDays: number;
  cancelMinHours: number;
  rescheduleMinHours: number;
  remindersEnabled: boolean;
  reminderHoursBefore: number;
  privacyControllerName: string;
  privacyControllerEmail: string;
  privacyControllerAddress: string;
  vatNumber: string;
  retentionMonths: number;
  legalNotes: string;
};

export type ServiceRecord = {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  prepMinutes: number;
  bufferMinutes: number;
  priceCents: number | null;
  color: string;
  active: boolean;
  visible: boolean;
  sortOrder: number;
};

type ScheduleBundle = {
  settings: SalonSettings;
  workingHours: WorkingWindow[];
  rules: ScheduleRule[];
  exceptions: ScheduleException[];
};

function admin(): SupabaseClient {
  const client = createAdminSupabase();
  if (!client) throw new HttpError(503, "Il salone non è ancora collegato all'archivio.");
  return client;
}

function mapSettings(row: Record<string, unknown>): SalonSettings {
  return {
    salonName: String(row.salon_name ?? "VC Hair Studio"),
    stylistName: String(row.stylist_name ?? ""),
    phone: String(row.phone ?? ""),
    email: String(row.email ?? ""),
    address: String(row.address ?? ""),
    city: String(row.city ?? ""),
    postalCode: String(row.postal_code ?? ""),
    bookingEnabled: Boolean(row.booking_enabled),
    setupCompleted: Boolean(row.setup_completed),
    slotMinutes: Number(row.slot_minutes ?? 15),
    minAdvanceMinutes: Number(row.min_advance_minutes ?? 120),
    maxHorizonDays: Number(row.max_horizon_days ?? 60),
    cancelMinHours: Number(row.cancel_min_hours ?? 24),
    rescheduleMinHours: Number(row.reschedule_min_hours ?? 24),
    remindersEnabled: Boolean(row.reminders_enabled),
    reminderHoursBefore: Number(row.reminder_hours_before ?? 24),
    privacyControllerName: String(row.privacy_controller_name ?? ""),
    privacyControllerEmail: String(row.privacy_controller_email ?? ""),
    privacyControllerAddress: String(row.privacy_controller_address ?? ""),
    vatNumber: String(row.vat_number ?? ""),
    retentionMonths: Number(row.retention_months ?? 24),
    legalNotes: String(row.legal_notes ?? ""),
  };
}

export function mapService(row: Record<string, unknown>): ServiceRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    description: String(row.description ?? ""),
    durationMinutes: Number(row.duration_minutes),
    prepMinutes: Number(row.prep_minutes ?? 0),
    bufferMinutes: Number(row.buffer_minutes ?? 0),
    priceCents: row.price_cents == null ? null : Number(row.price_cents),
    color: String(row.color ?? "#E8B4B8"),
    active: Boolean(row.active),
    visible: Boolean(row.visible),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function loadSettings(): Promise<SalonSettings> {
  const { data, error } = await admin().from("salon_settings").select("*").eq("id", 1).single();
  if (error || !data) throw new HttpError(503, "Le impostazioni del salone non sono disponibili.");
  return mapSettings(data);
}

export async function loadPublicServices(): Promise<ServiceRecord[]> {
  const { data, error } = await admin()
    .from("services")
    .select("*")
    .eq("active", true)
    .eq("visible", true)
    .order("sort_order");
  if (error) throw new HttpError(500, "Non è stato possibile leggere i trattamenti.");
  return (data ?? []).map((row) => mapService(row));
}

export async function loadService(id: string): Promise<ServiceRecord> {
  const { data, error } = await admin().from("services").select("*").eq("id", id).maybeSingle();
  if (error || !data || !data.active) throw new HttpError(404, "Il trattamento selezionato non è disponibile.");
  return mapService(data);
}

async function loadBundle(from: IsoDate, to: IsoDate): Promise<ScheduleBundle> {
  const client = admin();
  const [settings, hours, rules, exceptions] = await Promise.all([
    loadSettings(),
    client.from("working_hours").select("weekday, start_minute, end_minute"),
    client.from("recurrence_rules").select("*").lte("start_date", to),
    client
      .from("availability_exceptions")
      .select("*")
      .lte("start_date", to)
      .gte("end_date", from),
  ]);
  if (hours.error || rules.error || exceptions.error) {
    throw new HttpError(500, "Non è stato possibile leggere la disponibilità.");
  }
  return {
    settings,
    workingHours: (hours.data ?? []).map((row) => ({
      weekday: Number(row.weekday),
      startMin: Number(row.start_minute),
      endMin: Number(row.end_minute),
    })),
    rules: (rules.data ?? [])
      .filter((row) => !row.until_date || row.until_date >= from)
      .map((row) => ({
        id: String(row.id),
        kind: row.kind,
        frequency: row.frequency,
        weekdays: (row.weekdays ?? []).map(Number),
        startDate: String(row.start_date),
        untilDate: row.until_date ? String(row.until_date) : null,
        allDay: Boolean(row.all_day),
        startMin: row.start_minute == null ? null : Number(row.start_minute),
        endMin: row.end_minute == null ? null : Number(row.end_minute),
      })),
    exceptions: (exceptions.data ?? []).map((row) => ({
      id: String(row.id),
      kind: row.kind,
      startDate: String(row.start_date),
      endDate: String(row.end_date),
      allDay: Boolean(row.all_day),
      startMin: row.start_minute == null ? null : Number(row.start_minute),
      endMin: row.end_minute == null ? null : Number(row.end_minute),
      recurrenceId: row.recurrence_id ? String(row.recurrence_id) : null,
    })),
  };
}

async function loadAppointments(from: Date, to: Date): Promise<BusyAppointment[]> {
  const { data, error } = await admin()
    .from("appointments")
    .select("id, starts_at, ends_at, prep_minutes, buffer_minutes, status")
    .neq("status", "cancelled")
    .lt("starts_at", to.toISOString())
    .gt("ends_at", from.toISOString());
  if (error) throw new HttpError(500, "Non è stato possibile leggere gli appuntamenti.");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
    prepMinutes: Number(row.prep_minutes ?? 0),
    bufferMinutes: Number(row.buffer_minutes ?? 0),
  }));
}

function engineInput(
  bundle: ScheduleBundle,
  date: IsoDate,
  service: Pick<ServiceRecord, "durationMinutes" | "prepMinutes" | "bufferMinutes">,
  appointments: BusyAppointment[],
  options: { ignoreLeadTime?: boolean; ignoreHorizon?: boolean; ignoreAppointmentId?: string } = {},
): AvailabilityInput {
  return {
    date,
    now: new Date(),
    durationMinutes: service.durationMinutes,
    prepMinutes: service.prepMinutes,
    bufferMinutes: service.bufferMinutes,
    slotMinutes: bundle.settings.slotMinutes,
    minAdvanceMinutes: bundle.settings.minAdvanceMinutes,
    maxHorizonDays: bundle.settings.maxHorizonDays,
    workingHours: bundle.workingHours,
    rules: bundle.rules,
    exceptions: bundle.exceptions,
    appointments,
    ...options,
  };
}

export async function slotsForDate(
  serviceId: string,
  date: IsoDate,
  options?: { staff?: boolean; ignoreAppointmentId?: string; durationMinutes?: number },
) {
  const loaded = await loadService(serviceId);
  const service = options?.durationMinutes ? { ...loaded, durationMinutes: options.durationMinutes } : loaded;
  const bundle = await loadBundle(date, date);
  const start = zonedDateTime(date, 0);
  const end = zonedDateTime(addDays(date, 1), 0);
  if (!start || !end) return [];
  const appointments = await loadAppointments(new Date(start.getTime() - 6 * 3600_000), new Date(end.getTime() + 6 * 3600_000));
  return getAvailableSlots(
    engineInput(bundle, date, service, appointments, {
      ignoreLeadTime: options?.staff,
      ignoreHorizon: options?.staff,
      ignoreAppointmentId: options?.ignoreAppointmentId,
    }),
  );
}

export async function daysWithSlots(serviceId: string, month: string) {
  const bounds = monthBounds(month);
  if (!bounds) throw new HttpError(400, "Il mese indicato non è valido.");
  const service = await loadService(serviceId);
  const bundle = await loadBundle(bounds.start, bounds.end);
  const start = zonedDateTime(bounds.start, 0);
  const end = zonedDateTime(addDays(bounds.end, 1), 0);
  if (!start || !end) return [];
  const appointments = await loadAppointments(start, end);
  return eachDate(bounds.start, bounds.end).filter(
    (date) => getAvailableSlots(engineInput(bundle, date, service, appointments)).length > 0,
  );
}

export async function assertSlotFree(input: {
  service: ServiceRecord;
  start: Date;
  staff?: boolean;
  ignoreAppointmentId?: string;
}) {
  const date = romeDate(input.start);
  const slots = await slotsForDate(input.service.id, date, {
    staff: input.staff,
    ignoreAppointmentId: input.ignoreAppointmentId,
    durationMinutes: input.service.durationMinutes,
  });
  const match = slots.find((slot) => slot.start.getTime() === input.start.getTime());
  if (!match) {
    throw new HttpError(409, "L'orario selezionato non è più disponibile. Ti invitiamo a sceglierne un altro.");
  }
  return match;
}

export async function conflictingAppointments(start: Date, end: Date) {
  const appointments = await loadAppointments(new Date(start.getTime() - 24 * 3600_000), new Date(end.getTime() + 24 * 3600_000));
  const hits = conflictsWithAppointments(start, end, 0, 0, appointments);
  if (hits.length === 0) return [];
  const ids = hits.map((hit) => hit.id);
  const { data, error } = await admin()
    .from("appointments")
    .select("id, code, starts_at, ends_at, status, customers(first_name, last_name), services(name)")
    .in("id", ids);
  if (error) throw new HttpError(500, "Non è stato possibile verificare gli appuntamenti.");
  return data ?? [];
}

export { admin as requireAdminClient };

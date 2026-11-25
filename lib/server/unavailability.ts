import "server-only";
import { addDays, eachDate, romeDate, type IsoDate } from "@/lib/availability/time";
import { occursOn, type ScheduleRule } from "@/lib/availability/engine";
import { ConflictError, HttpError } from "@/lib/http";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { conflictingAppointments } from "@/lib/server/schedule";
import { cancelAppointment, rescheduleAppointment } from "@/lib/server/bookings";
import { zonedDateTime } from "@/lib/availability/time";

function db() {
  const client = createAdminSupabase();
  if (!client) throw new HttpError(503, "Il salone non è ancora collegato all'archivio.");
  return client;
}

export function spanFor(date: IsoDate, allDay: boolean, startMin: number | null, endMin: number | null) {
  if (allDay || startMin == null || endMin == null) {
    const start = zonedDateTime(date, 0);
    const end = zonedDateTime(addDays(date, 1), 0);
    if (!start || !end) return null;
    return { starts_at: start.toISOString(), ends_at: end.toISOString() };
  }
  const start = zonedDateTime(date, startMin);
  const end = zonedDateTime(date, endMin);
  if (!start || !end) return null;
  return { starts_at: start.toISOString(), ends_at: end.toISOString() };
}

async function overlaps(spans: { starts_at: string; ends_at: string }[]) {
  const found = [];
  for (const span of spans) {
    const rows = await conflictingAppointments(new Date(span.starts_at), new Date(span.ends_at));
    found.push(...rows);
  }
  const unique = new Map(found.map((row) => [row.id, row]));
  return [...unique.values()];
}

export async function saveUnavailability(input: {
  actorId: string;
  kind: "block" | "extra_opening" | "full_day_closure" | "reopen_day";
  startDate: IsoDate;
  endDate: IsoDate;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  frequency?: ScheduleRule["frequency"] | null;
  weekdays?: number[];
  untilDate?: IsoDate | null;
  reason?: string;
  notes?: string;
  resolution?: { action: "annulla" | "sposta"; appointments: { id: string; start?: string }[] };
}) {
  const dates = input.frequency
    ? eachDate(input.startDate, input.untilDate ?? addDays(romeDate(new Date()), 540)).filter((date) =>
        occursOn(
          {
            id: "nuovo",
            kind: input.kind === "extra_opening" ? "extra_opening" : "block",
            frequency: input.frequency!,
            weekdays: input.weekdays ?? [],
            startDate: input.startDate,
            untilDate: input.untilDate ?? null,
            allDay: input.allDay,
            startMin: input.startMin,
            endMin: input.endMin,
          },
          date,
        ),
      )
    : eachDate(input.startDate, input.endDate);

  const blocksTime = input.kind === "block" || input.kind === "full_day_closure";
  const spans = blocksTime
    ? dates
        .map((date) => spanFor(date, input.kind === "full_day_closure" || input.allDay, input.startMin, input.endMin))
        .filter((span): span is { starts_at: string; ends_at: string } => Boolean(span))
    : [];
  const conflicts = spans.length ? await overlaps(spans) : [];
  if (conflicts.length && !input.resolution) throw new ConflictError(conflicts);
  if (conflicts.length && input.resolution) {
    const ids = new Set(conflicts.map((row) => String(row.id)));
    const resolved = new Set(input.resolution.appointments.map((item) => item.id));
    if ([...ids].some((id) => !resolved.has(id)) || input.resolution.appointments.some((item) => !ids.has(item.id))) {
      throw new HttpError(400, "La risoluzione non corrisponde agli appuntamenti in conflitto.");
    }
    for (const item of input.resolution.appointments) {
      if (input.resolution.action === "annulla") {
        await cancelAppointment({ appointmentId: item.id, actorId: input.actorId, asStaff: true, reason: "Indisponibilità del salone" });
      } else if (item.start) {
        await rescheduleAppointment({
          appointmentId: item.id,
          actorId: input.actorId,
          asStaff: true,
          start: new Date(item.start),
        });
      }
    }
  }

  const client = db();
  if (input.frequency) {
    const { data, error } = await client
      .from("recurrence_rules")
      .insert({
        kind: input.kind === "extra_opening" ? "extra_opening" : "block",
        frequency: input.frequency,
        weekdays: input.weekdays ?? [],
        start_date: input.startDate,
        until_date: input.untilDate,
        all_day: input.allDay || input.kind === "full_day_closure",
        start_minute: input.startMin,
        end_minute: input.endMin,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
      })
      .select("id")
      .single();
    if (error || !data) throw new HttpError(500, "Non è stato possibile salvare la ripetizione.");
    if (spans.length) {
      const { error: blockError } = await client.from("blocked_slots").insert(
        spans.map((span) => ({ ...span, recurrence_id: data.id, reason: input.reason ?? null, notes: input.notes ?? null })),
      );
      if (blockError) throw new HttpError(409, "Nel periodo selezionato sono presenti appuntamenti già confermati.");
    }
    return { id: data.id, conflitti: conflicts };
  }

  const { data, error } = await client
    .from("availability_exceptions")
    .insert({
      kind: input.kind,
      start_date: input.startDate,
      end_date: input.endDate,
      all_day: input.allDay || input.kind === "full_day_closure" || input.kind === "reopen_day",
      start_minute: input.startMin,
      end_minute: input.endMin,
      reason: input.reason ?? null,
      notes: input.notes ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throw new HttpError(500, "Non è stato possibile salvare l'indisponibilità.");
  if (spans.length) {
    const { error: blockError } = await client.from("blocked_slots").insert(
      spans.map((span) => ({ ...span, exception_id: data.id, reason: input.reason ?? null, notes: input.notes ?? null })),
    );
    if (blockError) {
      await client.from("availability_exceptions").delete().eq("id", data.id);
      throw new HttpError(409, "Nel periodo selezionato sono presenti appuntamenti già confermati.");
    }
  }
  return { id: data.id, conflitti: conflicts };
}

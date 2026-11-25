import {
  addDays,
  diffDays,
  isoWeekday,
  minutesToLabel,
  romeDate,
  zonedDateTime,
  type IsoDate,
} from "@/lib/availability/time";

export type MinuteRange = { start: number; end: number };

export type WorkingWindow = {
  weekday: number;
  startMin: number;
  endMin: number;
};

export type RecurrenceFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "weekdays";

export type ScheduleRule = {
  id: string;
  kind: "block" | "extra_opening";
  frequency: RecurrenceFrequency;
  weekdays: number[];
  startDate: IsoDate;
  untilDate: IsoDate | null;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
};

export type ExceptionKind =
  | "block"
  | "extra_opening"
  | "full_day_closure"
  | "reopen_day"
  | "skip_occurrence";

export type ScheduleException = {
  id: string;
  kind: ExceptionKind;
  startDate: IsoDate;
  endDate: IsoDate;
  allDay: boolean;
  startMin: number | null;
  endMin: number | null;
  recurrenceId: string | null;
};

export type BusyAppointment = {
  id: string;
  start: Date;
  end: Date;
  prepMinutes: number;
  bufferMinutes: number;
};

export type AvailabilityInput = {
  date: IsoDate;
  now: Date;
  durationMinutes: number;
  prepMinutes: number;
  bufferMinutes: number;
  slotMinutes: number;
  minAdvanceMinutes: number;
  maxHorizonDays: number;
  workingHours: WorkingWindow[];
  rules: ScheduleRule[];
  exceptions: ScheduleException[];
  appointments: BusyAppointment[];
  ignoreLeadTime?: boolean;
  ignoreHorizon?: boolean;
  ignoreAppointmentId?: string;
};

export type Slot = {
  start: Date;
  end: Date;
  label: string;
  startMin: number;
};

const DAY_MINUTES = 24 * 60;

export function occursOn(rule: ScheduleRule, date: IsoDate): boolean {
  if (date < rule.startDate) return false;
  if (rule.untilDate && date > rule.untilDate) return false;
  const delta = diffDays(rule.startDate, date);
  switch (rule.frequency) {
    case "daily":
      return true;
    case "weekly":
      return delta % 7 === 0;
    case "biweekly":
      return delta % 14 === 0;
    case "monthly":
      return date.slice(8, 10) === rule.startDate.slice(8, 10);
    case "weekdays":
      return rule.weekdays.includes(isoWeekday(date));
    default:
      return false;
  }
}

export function coversDate(exception: ScheduleException, date: IsoDate): boolean {
  return date >= exception.startDate && date <= exception.endDate;
}

function isSkipped(ruleId: string, date: IsoDate, exceptions: ScheduleException[]): boolean {
  return exceptions.some(
    (exception) =>
      exception.kind === "skip_occurrence" &&
      exception.recurrenceId === ruleId &&
      coversDate(exception, date),
  );
}

export function mergeRanges(ranges: MinuteRange[]): MinuteRange[] {
  const sorted = ranges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MinuteRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (!last || range.start > last.end) merged.push({ ...range });
    else last.end = Math.max(last.end, range.end);
  }
  return merged;
}

export function subtractRange(windows: MinuteRange[], cut: MinuteRange): MinuteRange[] {
  if (cut.end <= cut.start) return windows;
  const next: MinuteRange[] = [];
  for (const window of windows) {
    if (cut.end <= window.start || cut.start >= window.end) {
      next.push(window);
      continue;
    }
    if (cut.start > window.start) {
      next.push({ start: window.start, end: Math.min(cut.start, window.end) });
    }
    if (cut.end < window.end) {
      next.push({ start: Math.max(cut.end, window.start), end: window.end });
    }
  }
  return next;
}

function clockRange(
  allDay: boolean,
  startMin: number | null,
  endMin: number | null,
): MinuteRange | null {
  if (allDay) return { start: 0, end: DAY_MINUTES };
  if (startMin == null || endMin == null || endMin <= startMin) return null;
  return { start: Math.max(0, startMin), end: Math.min(DAY_MINUTES, endMin) };
}

export function openWindowsForDate(
  input: Pick<AvailabilityInput, "date" | "workingHours" | "rules" | "exceptions">,
): { windows: MinuteRange[]; blocks: MinuteRange[]; closedByDay: boolean } {
  const { date, exceptions } = input;
  let windows: MinuteRange[] = input.workingHours
    .filter((row) => row.weekday === isoWeekday(date) && row.endMin > row.startMin)
    .map((row) => ({ start: row.startMin, end: row.endMin }));

  const openings: MinuteRange[] = [];
  for (const rule of input.rules) {
    if (rule.kind !== "extra_opening" || !occursOn(rule, date) || isSkipped(rule.id, date, exceptions)) {
      continue;
    }
    const range = clockRange(rule.allDay, rule.startMin, rule.endMin);
    if (range) openings.push(range);
  }
  for (const exception of exceptions) {
    if (exception.kind !== "extra_opening" || !coversDate(exception, date)) continue;
    const range = clockRange(exception.allDay, exception.startMin, exception.endMin);
    if (range) openings.push(range);
  }
  windows = mergeRanges([...windows, ...openings]);

  const closed = exceptions.some(
    (exception) => exception.kind === "full_day_closure" && coversDate(exception, date),
  );
  const reopened = exceptions.some(
    (exception) => exception.kind === "reopen_day" && coversDate(exception, date),
  );
  const closedByDay = closed && !reopened;
  if (closedByDay) windows = [];

  const blocks: MinuteRange[] = [];
  for (const rule of input.rules) {
    if (rule.kind !== "block" || !occursOn(rule, date) || isSkipped(rule.id, date, exceptions)) continue;
    const range = clockRange(rule.allDay, rule.startMin, rule.endMin);
    if (range) blocks.push(range);
  }
  for (const exception of exceptions) {
    if (exception.kind !== "block" || !coversDate(exception, date)) continue;
    const range = clockRange(exception.allDay, exception.startMin, exception.endMin);
    if (range) blocks.push(range);
  }

  for (const block of blocks) windows = subtractRange(windows, block);
  return { windows: mergeRanges(windows), blocks, closedByDay };
}

export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function appointmentBusy(appointment: BusyAppointment): { start: Date; end: Date } {
  return {
    start: new Date(appointment.start.getTime() - appointment.prepMinutes * 60_000),
    end: new Date(appointment.end.getTime() + appointment.bufferMinutes * 60_000),
  };
}

export function conflictsWithAppointments(
  start: Date,
  end: Date,
  prepMinutes: number,
  bufferMinutes: number,
  appointments: BusyAppointment[],
): BusyAppointment[] {
  const busyStart = new Date(start.getTime() - prepMinutes * 60_000);
  const busyEnd = new Date(end.getTime() + bufferMinutes * 60_000);
  return appointments.filter((appointment) => {
    const other = appointmentBusy(appointment);
    return rangesOverlap(busyStart, busyEnd, other.start, other.end);
  });
}

function bufferHitsBlock(
  startMin: number,
  duration: number,
  buffer: number,
  blocks: MinuteRange[],
): boolean {
  if (buffer <= 0) return false;
  const from = startMin + duration;
  const to = from + buffer;
  return blocks.some((block) => from < block.end && block.start < to);
}

function insideSingleWindow(windows: MinuteRange[], from: number, to: number): boolean {
  return windows.some((window) => from >= window.start && to <= window.end);
}

export function getAvailableSlots(input: AvailabilityInput): Slot[] {
  if (input.durationMinutes <= 0 || input.slotMinutes <= 0) return [];
  if (input.prepMinutes < 0 || input.bufferMinutes < 0) return [];

  const today = romeDate(input.now);
  if (input.date < today) return [];
  if (!input.ignoreHorizon && input.date > addDays(today, input.maxHorizonDays)) return [];

  const { windows, blocks } = openWindowsForDate(input);
  const appointments = input.appointments.filter(
    (appointment) => appointment.id !== input.ignoreAppointmentId,
  );
  const earliest = input.now.getTime() + input.minAdvanceMinutes * 60_000;
  const slots: Slot[] = [];

  for (const window of windows) {
    let cursor =
      Math.ceil((window.start + input.prepMinutes) / input.slotMinutes) * input.slotMinutes;
    while (cursor + input.durationMinutes <= window.end) {
      const prepStart = cursor - input.prepMinutes;
      const treatmentEnd = cursor + input.durationMinutes;
      const fits =
        insideSingleWindow(windows, prepStart, treatmentEnd) &&
        !bufferHitsBlock(cursor, input.durationMinutes, input.bufferMinutes, blocks);
      if (fits) {
        const start = zonedDateTime(input.date, cursor);
        if (start) {
          const end = new Date(start.getTime() + input.durationMinutes * 60_000);
          const leadOk = input.ignoreLeadTime || start.getTime() >= earliest;
          const conflicts = conflictsWithAppointments(
            start,
            end,
            input.prepMinutes,
            input.bufferMinutes,
            appointments,
          );
          if (leadOk && conflicts.length === 0) {
            slots.push({ start, end, startMin: cursor, label: minutesToLabel(cursor) });
          }
        }
      }
      cursor += input.slotMinutes;
    }
  }

  return slots;
}

export type OccupancyResult = "confermato" | "occupato" | "duplicato";

/** Simula il vincolo di esclusione e la chiave di idempotenza usati da PostgreSQL. */
export class PrenotazioniSimultanee {
  private readonly spans: { key: string; start: number; end: number }[] = [];

  prova(key: string, start: number, end: number): OccupancyResult {
    if (this.spans.some((span) => span.key === key)) return "duplicato";
    if (this.spans.some((span) => start < span.end && span.start < end)) return "occupato";
    this.spans.push({ key, start, end });
    return "confermato";
  }
}

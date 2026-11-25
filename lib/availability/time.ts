import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const TIME_ZONE = "Europe/Rome";

export type IsoDate = string;

export function isIsoDate(value: string): value is IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isoWeekday(date: IsoDate): number {
  const [year, month, day] = date.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const monthText = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dayText = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}-${monthText}-${dayText}`;
}

export function diffDays(from: IsoDate, to: IsoDate): number {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const delta =
    Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay);
  return Math.round(delta / 86_400_000);
}

export function romeDate(instant: Date): IsoDate {
  return formatInTimeZone(instant, TIME_ZONE, "yyyy-MM-dd");
}

export function minutesToLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

/**
 * Interpreta una data e dei minuti come orario civile di Roma.
 * Restituisce null se l'orario non esiste, per esempio durante il passaggio all'ora legale.
 */
export function zonedDateTime(date: IsoDate, minutes: number): Date | null {
  if (!isIsoDate(date) || !Number.isInteger(minutes) || minutes < 0 || minutes >= 24 * 60) {
    return null;
  }
  const label = `${date} ${minutesToLabel(minutes)}`;
  const instant = fromZonedTime(`${label}:00`, TIME_ZONE);
  if (Number.isNaN(instant.getTime())) return null;
  const roundTrip = formatInTimeZone(instant, TIME_ZONE, "yyyy-MM-dd HH:mm");
  return roundTrip === label ? instant : null;
}

export function eachDate(start: IsoDate, end: IsoDate): IsoDate[] {
  if (end < start) return [];
  const dates: IsoDate[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 800) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

export function monthBounds(month: string): { start: IsoDate; end: IsoDate } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const start = `${month}-01`;
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start, end: `${month}-${String(last).padStart(2, "0")}` };
}

import { ensureDatabase } from "@/lib/server/schema";
import { NextResponse } from "next/server";
import { addDays, romeDate, zonedDateTime } from "@/lib/availability/time";
import { jsonError, requireAdmin } from "@/lib/server/guard";

export async function GET() {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const today = romeDate(new Date());
    const tomorrow = addDays(today, 1);
    const start = zonedDateTime(today, 0)?.toISOString();
    const endToday = zonedDateTime(tomorrow, 0)?.toISOString();
    const endTomorrow = zonedDateTime(addDays(tomorrow, 1), 0)?.toISOString();
    const [appointments, customers, hours] = await Promise.all([
      admin.from("appointments").select("id, starts_at, ends_at, status, price_cents, amount_paid_cents, created_at").gte("starts_at", start).lt("starts_at", endTomorrow),
      admin.from("customers").select("id", { count: "exact", head: true }).is("archived_at", null),
      admin.from("working_hours").select("weekday, start_minute, end_minute").eq("weekday", isoWeekdayNumber(today)),
    ]);
    const rows = appointments.data ?? [];
    const inToday = rows.filter((row) => row.starts_at < (endToday ?? ""));
    const activeToday = inToday.filter((row) => row.status !== "cancelled");
    const sum = (list: typeof rows, field: "price_cents" | "amount_paid_cents") =>
      list.reduce((total, row) => total + (row[field] == null ? 0 : Number(row[field])), 0);
    const openMinutes = (hours.data ?? []).reduce((total, row) => total + Number(row.end_minute) - Number(row.start_minute), 0);
    const bookedMinutes = activeToday.reduce((total, row) => total + (new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60000, 0);
    const next = rows
      .filter((row) => row.status === "confirmed" && new Date(row.starts_at).getTime() >= Date.now())
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
    return NextResponse.json({
      oggi: activeToday.length,
      domani: rows.filter((row) => row.starts_at >= (endToday ?? "") && row.status !== "cancelled").length,
      prossimo: next?.starts_at ?? null,
      nuove: rows.filter((row) => romeDate(new Date(row.created_at)) === today).length,
      completati: inToday.filter((row) => row.status === "completed").length,
      annullati: inToday.filter((row) => row.status === "cancelled").length,
      clienti: customers.count ?? 0,
      orePrenotate: Math.round(bookedMinutes) / 60,
      oreDisponibili: Math.max(0, Math.round(openMinutes - bookedMinutes)) / 60,
      incassoPrevisto: sum(activeToday.filter((row) => row.price_cents != null), "price_cents"),
      senzaPrezzo: activeToday.filter((row) => row.price_cents == null).length,
      incassoEffettivo: sum(inToday, "amount_paid_cents"),
    });
  } catch (error) {
    return jsonError(error);
  }
}

function isoWeekdayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

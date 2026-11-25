import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/format";

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const admin = createAdminSupabase();
  if (!admin) return new NextResponse("Calendario non disponibile", { status: 503 });
  const { data } = await admin
    .from("appointments")
    .select("code, starts_at, ends_at, status, services(name)")
    .eq("calendar_token", token)
    .maybeSingle();
  if (!data || data.status === "cancelled") {
    return new NextResponse("Appuntamento non trovato", { status: 404 });
  }
  const services = data.services as { name?: string } | { name?: string }[] | null;
  const serviceName = (Array.isArray(services) ? services[0]?.name : services?.name) ?? "Trattamento";
  const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(".000", "");
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VC Hair Studio//Prenotazioni//IT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${token}@vc-hair-studio`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(data.starts_at)}`,
    `DTEND:${stamp(data.ends_at)}`,
    `SUMMARY:VC Hair Studio — ${serviceName}`,
    `DESCRIPTION:Appuntamento ${data.code}. ${formatDate(new Date(data.starts_at))} alle ${formatTime(new Date(data.starts_at))}. Pagamento in salone.`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="vc-hair-studio-${data.code}.ics"`,
    },
  });
}

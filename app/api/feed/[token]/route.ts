import { ensureDatabase } from "@/lib/server/schema";
import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { buildCalendar, salonEvent, salonSelect } from "@/lib/ics";

export const dynamic = "force-dynamic";

/**
 * Calendario dell'agenda da abbonare sull'iPhone (Impostazioni → Calendario → Account → Aggiungi calendario).
 * Protetto dal link segreto: l'app Calendario non può usare il login.
 */
export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  await ensureDatabase().catch(() => undefined);
  const { token } = await context.params;
  const admin = createAdminSupabase();
  if (!admin || !/^[a-f0-9]{24,64}$/i.test(token.replace(/\.ics$/, ""))) return new NextResponse("Non trovato", { status: 404 });
  const clean = token.replace(/\.ics$/, "");
  const settings = await admin.from("salon_settings").select("admin_calendar_token, address, city, salon_name").eq("id", 1).maybeSingle();
  if (settings.error || !settings.data || settings.data.admin_calendar_token !== clean) {
    return new NextResponse("Non trovato", { status: 404 });
  }
  const from = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const to = new Date(Date.now() + 365 * 86_400_000).toISOString();
  const { data } = await admin
    .from("appointments")
    .select(salonSelect)
    .in("status", ["confirmed", "in_progress", "completed"])
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");
  const place = [settings.data.address, settings.data.city].filter(Boolean).join(", ");
  const body = buildCalendar((data ?? []).map((row) => salonEvent(row as never, place)), `${settings.data.salon_name || "VC Hair Studio"} · Agenda`);
  return new NextResponse(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

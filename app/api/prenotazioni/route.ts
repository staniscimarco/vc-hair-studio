import { NextResponse } from "next/server";
import { z } from "zod";
import { clientIp } from "@/lib/http";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireUser } from "@/lib/server/guard";
import { createOnlineBooking } from "@/lib/server/bookings";
import { limitRequests } from "@/lib/server/notices";
import { customerForUser } from "@/lib/server/bookings";
import { createAdminSupabase } from "@/lib/supabase/admin";

const schema = z.object({
  servizioId: z.string().uuid(),
  inizio: z.string().datetime(),
  chiaveIdempotenza: z.string().uuid(),
});

export async function GET() {
  try {
    const { user } = await requireUser();
    const customer = await customerForUser(user.id);
    const admin = createAdminSupabase();
    const { data, error } = await admin!
      .from("appointments")
      .select("id, code, starts_at, ends_at, status, price_cents, calendar_token, services(name, duration_minutes)")
      .eq("customer_id", customer.id)
      .order("starts_at", { ascending: false });
    if (error) return NextResponse.json({ errore: "Non è stato possibile leggere gli appuntamenti." }, { status: 500 });
    return NextResponse.json({ appuntamenti: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireUser();
    await limitRequests(`prenotazione:${clientIp(request)}`, 10);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "Controlla i dati della prenotazione." }, { status: 400 });
    const saved = await createOnlineBooking({
      userId: user.id,
      serviceId: parsed.data.servizioId,
      startIso: parsed.data.inizio,
      idempotencyKey: parsed.data.chiaveIdempotenza,
    });
    return NextResponse.json({
      codice: saved.code,
      token: saved.calendar_token,
      inizio: saved.starts_at,
      id: saved.id,
    });
  } catch (error) {
    return jsonError(error);
  }
}

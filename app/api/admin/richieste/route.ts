import { ensureDatabase } from "@/lib/server/schema";
import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { decideAppointment } from "@/lib/server/bookings";

export const runtime = "nodejs";

const select =
  "id, code, starts_at, ends_at, status, price_cents, notes, created_at, customers(first_name, last_name, phone, email, address), services(name, duration_minutes)";

/** Richieste online in attesa di approvazione (o una sola, con ?id=). */
export async function GET(request: Request) {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const { data, error } = await admin.from("appointments").select(select).eq("id", id).maybeSingle();
      if (error || !data) return NextResponse.json({ errore: "Prenotazione non trovata." }, { status: 404 });
      return NextResponse.json({ richiesta: data });
    }
    const { data } = await admin
      .from("appointments")
      .select(select)
      .eq("status", "pending")
      .gte("starts_at", new Date(Date.now() - 3600_000).toISOString())
      .order("starts_at", { ascending: true })
      .limit(50);
    return NextResponse.json({ richieste: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireAdmin();
    const parsed = z.object({ id: z.string().uuid(), accetta: z.boolean() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "Dati non validi." }, { status: 400 });
    const result = await decideAppointment({ appointmentId: parsed.data.id, actorId: user.id, accept: parsed.data.accetta });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

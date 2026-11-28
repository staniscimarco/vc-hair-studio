import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security/http";
import { cancelAppointment, rescheduleAppointment } from "@/lib/server/bookings";
import { jsonError, requireUser } from "@/lib/server/guard";
import { notifyAdmin } from "@/lib/server/notices";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { formatDateLong, formatTime } from "@/lib/format";
import { romeDate } from "@/lib/availability/time";

const patchSchema = z.object({ inizio: z.string().datetime() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireUser();
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "L'orario non è valido." }, { status: 400 });
    const start = new Date(parsed.data.inizio);
    const saved = await rescheduleAppointment({
      appointmentId: id,
      userId: user.id,
      actorId: user.id,
      start,
    });
    // L'amministratrice viene avvisata subito del cambio di orario.
    const admin = createAdminSupabase();
    const info = admin
      ? await admin.from("appointments").select("customers(first_name, last_name), services(name)").eq("id", id).maybeSingle()
      : null;
    const customer = info?.data ? ((Array.isArray(info.data.customers) ? info.data.customers[0] : info.data.customers) as { first_name?: string; last_name?: string } | null) : null;
    const service = info?.data ? ((Array.isArray(info.data.services) ? info.data.services[0] : info.data.services) as { name?: string } | null) : null;
    await notifyAdmin({
      event: "moved",
      title: "Appuntamento spostato",
      body: `${`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "Una cliente"} ha spostato ${service?.name ?? "l'appuntamento"} a ${formatDateLong(start)} alle ${formatTime(start)}.`,
      url: `/admin/calendario?date=${romeDate(start)}&appointment=${id}`,
      appointmentId: id,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireUser();
    const { id } = await context.params;
    await cancelAppointment({ appointmentId: id, userId: user.id, actorId: user.id });
    return NextResponse.json({ stato: "annullato" });
  } catch (error) {
    return jsonError(error);
  }
}

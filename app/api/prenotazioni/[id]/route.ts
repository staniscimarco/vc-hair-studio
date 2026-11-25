import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security/http";
import { cancelAppointment, rescheduleAppointment } from "@/lib/server/bookings";
import { jsonError, requireUser } from "@/lib/server/guard";

const patchSchema = z.object({ inizio: z.string().datetime() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireUser();
    const { id } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "L'orario non è valido." }, { status: 400 });
    const saved = await rescheduleAppointment({
      appointmentId: id,
      userId: user.id,
      actorId: user.id,
      start: new Date(parsed.data.inizio),
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

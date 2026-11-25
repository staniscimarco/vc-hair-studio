import { NextResponse } from "next/server";
import { isIsoDate } from "@/lib/availability/time";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { daysWithSlots, slotsForDate } from "@/lib/server/schedule";

export const runtime = "nodejs";

/**
 * Orari liberi per gli appuntamenti inseriti dal salone: senza anticipo minimo né limite massimo,
 * con la durata scelta (può essere diversa da quella standard del trattamento).
 */
export async function GET(request: Request) {
  try {
    await requireAdmin();
    const url = new URL(request.url);
    const serviceId = url.searchParams.get("servizio");
    const day = url.searchParams.get("giorno");
    const month = url.searchParams.get("mese");
    const duration = Number(url.searchParams.get("durata") ?? 0);
    if (!serviceId) return NextResponse.json({ errore: "Scegli il trattamento." }, { status: 400 });
    if (day) {
      if (!isIsoDate(day)) return NextResponse.json({ errore: "Data non valida." }, { status: 400 });
      const slots = await slotsForDate(serviceId, day, { staff: true, durationMinutes: duration >= 15 ? duration : undefined });
      return NextResponse.json({ orari: slots.map((slot) => ({ inizio: slot.start.toISOString(), etichetta: slot.label })) });
    }
    if (month) return NextResponse.json({ giorni: await daysWithSlots(serviceId, month) });
    return NextResponse.json({ errore: "Indica un giorno o un mese." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}

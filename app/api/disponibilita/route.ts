import { NextResponse } from "next/server";
import { isIsoDate } from "@/lib/availability/time";
import { jsonError } from "@/lib/server/guard";
import { daysWithSlots, slotsForDate } from "@/lib/server/schedule";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceId = url.searchParams.get("servizio");
    const day = url.searchParams.get("giorno");
    const month = url.searchParams.get("mese");
    if (!serviceId) return NextResponse.json({ errore: "Seleziona un trattamento." }, { status: 400 });
    if (day) {
      if (!isIsoDate(day)) return NextResponse.json({ errore: "La data non è valida." }, { status: 400 });
      const slots = await slotsForDate(serviceId, day);
      return NextResponse.json({
        orari: slots.map((slot) => ({ inizio: slot.start.toISOString(), fine: slot.end.toISOString(), etichetta: slot.label })),
      });
    }
    if (month) {
      return NextResponse.json({ giorni: await daysWithSlots(serviceId, month) });
    }
    return NextResponse.json({ errore: "Indica un giorno o un mese." }, { status: 400 });
  } catch (error) {
    return jsonError(error);
  }
}

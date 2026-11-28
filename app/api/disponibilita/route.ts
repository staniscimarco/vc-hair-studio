import { NextResponse } from "next/server";
import { isIsoDate } from "@/lib/availability/time";
import { jsonError } from "@/lib/server/guard";
import { daysWithSlots, slotsWithBusy } from "@/lib/server/schedule";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

/** Appuntamento della persona collegata (per lo spostamento): id e durata, altrimenti null. */
async function ownAppointment(id: string | null) {
  if (!id) return null;
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const admin = createAdminSupabase();
  if (!user || !admin) return null;
  const { data } = await admin
    .from("appointments")
    .select("id, starts_at, ends_at, customers!inner(profile_id)")
    .eq("id", id)
    .eq("customers.profile_id", user.id)
    .maybeSingle();
  if (!data) return null;
  return {
    ignoreAppointmentId: String(data.id),
    durationMinutes: Math.round((new Date(data.ends_at).getTime() - new Date(data.starts_at).getTime()) / 60_000),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceId = url.searchParams.get("servizio");
    const day = url.searchParams.get("giorno");
    const month = url.searchParams.get("mese");
    if (!serviceId) return NextResponse.json({ errore: "Seleziona un trattamento." }, { status: 400 });
    if (day) {
      if (!isIsoDate(day)) return NextResponse.json({ errore: "La data non è valida." }, { status: 400 });
      // Spostamento di un proprio appuntamento: l'orario attuale non conta come occupato.
      const exclude = await ownAppointment(url.searchParams.get("escludi"));
      const { free, busy } = await slotsWithBusy(serviceId, day, exclude ?? undefined);
      return NextResponse.json({
        orari: free.map((slot) => ({ inizio: slot.start.toISOString(), fine: slot.end.toISOString(), etichetta: slot.label })),
        occupati: busy.map((slot) => ({ inizio: slot.start.toISOString(), etichetta: slot.label })),
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

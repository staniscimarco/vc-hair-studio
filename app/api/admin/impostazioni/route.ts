import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { loadSettings } from "@/lib/server/schedule";

export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await loadSettings());
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const body = await request.json();
    const { error } = await admin.from("salon_settings").update({
      salon_name: body.nomeSalone,
      stylist_name: body.parrucchiera,
      phone: body.telefono,
      email: body.email,
      address: body.indirizzo,
      city: body.citta,
      postal_code: body.cap,
      booking_enabled: Boolean(body.prenotazioniAttive),
      setup_completed: Boolean(body.configurazioneCompleta),
      slot_minutes: Number(body.slotMinuti),
      min_advance_minutes: Number(body.anticipoMinuti),
      max_horizon_days: Number(body.orizzonteGiorni),
      cancel_min_hours: Number(body.oreAnnullamento),
      reschedule_min_hours: Number(body.oreModifica),
      reminders_enabled: Boolean(body.promemoriaAttivi),
      reminder_hours_before: Number(body.orePromemoria),
      privacy_controller_name: body.titolareNome ?? "",
      privacy_controller_email: body.titolareEmail ?? "",
      privacy_controller_address: body.titolareIndirizzo ?? "",
      vat_number: body.partitaIva ?? "",
      retention_months: Number(body.conservazioneMesi ?? 24),
      legal_notes: body.noteLegali ?? "",
    }).eq("id", 1);
    if (error) return NextResponse.json({ errore: "Non è stato possibile salvare le impostazioni." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

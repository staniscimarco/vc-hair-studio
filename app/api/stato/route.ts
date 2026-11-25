import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/guard";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { loadPublicServices, loadSettings } from "@/lib/server/schedule";

export async function GET() {
  try {
    if (!isServiceRoleConfigured()) {
      return NextResponse.json({
        configurato: false,
        prenotazioniAttive: false,
        servizi: [],
      });
    }
    const [settings, services] = await Promise.all([loadSettings(), loadPublicServices()]);
    const essential = Boolean(settings.salonName) && services.length > 0;
    return NextResponse.json({
      configurato: settings.setupCompleted && essential,
      prenotazioniAttive: settings.bookingEnabled && settings.setupCompleted,
      nomeSalone: settings.salonName,
      servizi: services.map((service) => ({
        id: service.id,
        nome: service.name,
        descrizione: service.description,
        durataMinuti: service.durationMinutes,
        prezzoCentesimi: service.priceCents,
        colore: service.color,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

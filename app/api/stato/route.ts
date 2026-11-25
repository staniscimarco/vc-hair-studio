import { NextResponse } from "next/server";
import { jsonError } from "@/lib/server/guard";
import { ensureDatabase } from "@/lib/server/schema";
import { isServiceRoleConfigured } from "@/lib/supabase/env";
import { loadPublicServices, loadSettings } from "@/lib/server/schedule";
import { currentPromotion } from "@/lib/server/promotions";
import { approvalRequired } from "@/lib/server/bookings";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!isServiceRoleConfigured()) {
      return NextResponse.json({
        configurato: false,
        prenotazioniAttive: false,
        servizi: [],
      });
    }
    await ensureDatabase();
    const [settings, services, promozione, approvazione] = await Promise.all([
      loadSettings(),
      loadPublicServices(),
      currentPromotion(),
      approvalRequired(),
    ]);
    const essential = Boolean(settings.salonName) && services.length > 0;
    return NextResponse.json({
      configurato: settings.setupCompleted && essential,
      prenotazioniAttive: settings.bookingEnabled && settings.setupCompleted,
      nomeSalone: settings.salonName,
      approvazione,
      promozione: promozione
        ? { titolo: promozione.titolo, sottotitolo: promozione.sottotitolo, badge: promozione.badge, sconto: promozione.sconto, servizi: promozione.servizi, al: promozione.al }
        : null,
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

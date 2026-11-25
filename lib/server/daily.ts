import "server-only";
import { addDays, romeDate } from "@/lib/availability/time";
import { formatTime } from "@/lib/format";
import { loadPublicServices, slotsForDate } from "@/lib/server/schedule";
import { currentPromotion } from "@/lib/server/promotions";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { broadcastToCustomers } from "@/lib/server/push";

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;

/** Ora corrente a Roma (0–23). */
function romeHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(now));
}

/**
 * Messaggio con gli orari liberi di oggi e domani, calcolati sul trattamento più breve.
 * Restituisce null se non c'è nulla di libero (in quel caso non ha senso disturbare).
 */
export async function availabilityMessage(now = new Date()) {
  const services = await loadPublicServices();
  if (!services.length) return null;
  const shortest = [...services].sort((a, b) => a.durationMinutes - b.durationMinutes)[0];
  const today = romeDate(now);
  const tomorrow = addDays(today, 1);
  const [todaySlots, tomorrowSlots] = await Promise.all([slotsForDate(shortest.id, today), slotsForDate(shortest.id, tomorrow)]);
  const futureToday = todaySlots.filter((slot) => slot.start.getTime() > now.getTime());
  if (!futureToday.length && !tomorrowSlots.length) return null;

  const parts: string[] = [];
  if (futureToday.length) {
    parts.push(`Oggi ${futureToday.length === 1 ? "c'è ancora 1 posto" : `ci sono ancora ${futureToday.length} posti`}, il primo alle ${formatTime(futureToday[0].start)}.`);
  }
  if (tomorrowSlots.length) {
    parts.push(`Domani ${tomorrowSlots.length === 1 ? "1 posto libero" : `${tomorrowSlots.length} posti liberi`}.`);
  }
  const promo = await currentPromotion(today);
  if (promo && promo.sconto > 0) parts.push(`${promo.titolo}: -${promo.sconto}%!`);
  parts.push("Prenota in un minuto ✨");
  return {
    title: futureToday.length ? "C'è posto per te oggi 💜" : "Domani c'è posto per te 💜",
    body: parts.join(" "),
    url: "/prenota",
  };
}

/** Eseguito dal cron orario: invia una sola volta al giorno, all'ora scelta dal salone. */
export async function dailyAvailabilityBroadcast(admin: Admin, now = new Date()) {
  const { data, error } = await admin.from("salon_settings").select("daily_push_enabled, daily_push_hour").eq("id", 1).maybeSingle();
  if (error || !data) return { inviata: false, motivo: "impostazione_assente" };
  const settings = data as { daily_push_enabled?: boolean; daily_push_hour?: number };
  if (!settings.daily_push_enabled) return { inviata: false, motivo: "disattivato" };
  if (romeHour(now) < Number(settings.daily_push_hour ?? 9)) return { inviata: false, motivo: "non_ancora_ora" };
  const message = await availabilityMessage(now);
  if (!message) return { inviata: false, motivo: "nessun_posto_libero" };
  return broadcastToCustomers(admin, { ...message, kind: "disponibilita", dedupeKey: `disponibilita:${romeDate(now)}` });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { isAllowedPushEndpoint, sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { ensureDatabase } from "@/lib/server/schema";
import { broadcastToCustomers, pushReady, sendToSubscriptions, subscriptionsFor } from "@/lib/server/push";
import { availabilityMessage } from "@/lib/server/daily";

export const runtime = "nodejs";

const broadcastSchema = z.object({
  titolo: z.string().trim().min(2, "Scrivi un titolo.").max(60, "Il titolo è troppo lungo (max 60 caratteri)."),
  messaggio: z.string().trim().min(2, "Scrivi il messaggio.").max(180, "Il messaggio è troppo lungo (max 180 caratteri)."),
  url: z.enum(["/", "/prenota", "/i-miei-appuntamenti"]).default("/prenota"),
});

export async function GET() {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin, user } = await requireAdmin();
    const [devices, history, customers, broadcasts, settings] = await Promise.all([
      admin.from("push_subscriptions").select("id, endpoint, user_agent, created_at, disabled_at, fail_count").eq("profile_id", user.id),
      admin.from("notifications").select("id, title, body, url, read_at, created_at").in("event", ["created", "signup"]).order("created_at", { ascending: false }).limit(50),
      subscriptionsFor(admin, "customer"),
      admin.from("broadcasts").select("id, kind, title, body, recipients, sent, created_at").order("created_at", { ascending: false }).limit(20),
      admin.from("salon_settings").select("daily_push_enabled, daily_push_hour, require_approval").eq("id", 1).maybeSingle(),
    ]);
    const prefs = (settings.data ?? {}) as { daily_push_enabled?: boolean; daily_push_hour?: number; require_approval?: boolean };
    return NextResponse.json({
      dispositivi: devices.data ?? [],
      storico: history.data ?? [],
      clientiIscritte: customers.length,
      invii: broadcasts.data ?? [],
      giornaliero: { attivo: Boolean(prefs.daily_push_enabled), ora: Number(prefs.daily_push_hour ?? 9) },
      approvazione: prefs.require_approval !== false,
      vapidConfigurato: pushReady(),
      chiavePubblica: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin, user } = await requireAdmin();
    const body = await request.json();

    if (body.azione === "prova") {
      if (!pushReady()) return NextResponse.json({ inviata: false, motivo: "Chiavi di notifica non configurate." });
      const devices = await subscriptionsFor(admin, "admin");
      const sent = await sendToSubscriptions(admin, devices, {
        title: "Prova VC Hair Studio",
        body: "Le notifiche del salone sono attive: riceverai un avviso a ogni nuova prenotazione.",
        url: "/admin",
      });
      return NextResponse.json({ inviata: sent > 0, dispositivi: sent });
    }
    if (body.azione === "invia-clienti") {
      const parsed = broadcastSchema.safeParse({ titolo: body.titolo, messaggio: body.messaggio, url: body.url });
      if (!parsed.success) return NextResponse.json({ errore: parsed.error.issues[0]?.message }, { status: 400 });
      const result = await broadcastToCustomers(admin, {
        kind: "manuale",
        title: parsed.data.titolo,
        body: parsed.data.messaggio,
        url: parsed.data.url,
      });
      return NextResponse.json(result);
    }
    if (body.azione === "anteprima-disponibilita") {
      return NextResponse.json({ messaggio: await availabilityMessage() });
    }
    if (body.azione === "invia-disponibilita") {
      const message = await availabilityMessage();
      if (!message) return NextResponse.json({ inviata: false, motivo: "Oggi e domani non ci sono posti liberi da segnalare." });
      return NextResponse.json(await broadcastToCustomers(admin, { ...message, kind: "disponibilita" }));
    }
    if (body.azione === "preferenze") {
      const parsed = z
        .object({ attivo: z.boolean(), ora: z.number().int().min(6).max(21), approvazione: z.boolean() })
        .safeParse({ attivo: body.attivo, ora: body.ora, approvazione: body.approvazione });
      if (!parsed.success) return NextResponse.json({ errore: "Preferenze non valide." }, { status: 400 });
      const { error } = await admin
        .from("salon_settings")
        .update({ daily_push_enabled: parsed.data.attivo, daily_push_hour: parsed.data.ora, require_approval: parsed.data.approvazione })
        .eq("id", 1);
      if (error) return NextResponse.json({ errore: "Non è stato possibile salvare le preferenze." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (body.azione === "rimuovi" && body.id) {
      await admin.from("push_subscriptions").delete().eq("id", body.id).eq("profile_id", user.id);
      return NextResponse.json({ ok: true });
    }
    if (body.azione === "letta" && body.id) {
      await admin.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", body.id);
      return NextResponse.json({ ok: true });
    }
    const endpoint = String(body.endpoint ?? "");
    if (!isAllowedPushEndpoint(endpoint) || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ errore: "Sottoscrizione non valida." }, { status: 400 });
    }
    const { error } = await admin.from("push_subscriptions").upsert({
      profile_id: user.id,
      endpoint,
      p256dh: body.keys.p256dh,
      auth_key: body.keys.auth,
      user_agent: request.headers.get("user-agent"),
      disabled_at: null,
    }, { onConflict: "endpoint" });
    if (error) return NextResponse.json({ errore: "Non è stato possibile salvare il dispositivo." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

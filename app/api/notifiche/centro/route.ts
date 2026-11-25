import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError } from "@/lib/server/guard";
import { ensureDatabase } from "@/lib/server/schema";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { id: string; title: string; body: string; url: string; createdAt: string; letta: boolean; tipo: "personale" | "salone" | "prenotazione" };

async function who() {
  const supabase = await createServerSupabase();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  const admin = createAdminSupabase();
  if (!admin) return { admin: null, user: null, role: null as string | null, seenAt: null as string | null };
  if (!user) return { admin, user: null, role: null, seenAt: null };
  const profile = await admin.from("profiles").select("role, notifications_seen_at").eq("id", user.id).maybeSingle();
  const row = profile.data as { role?: string; notifications_seen_at?: string | null } | null;
  return { admin, user, role: row?.role ?? "customer", seenAt: row?.notifications_seen_at ?? null };
}

/**
 * Centro notifiche.
 * Admin: nuove prenotazioni (lette/non lette).
 * Cliente: esiti delle richieste + messaggi del salone (posti liberi, promozioni).
 * Senza accesso: solo messaggi del salone; "visto" arriva dal telefono.
 */
export async function GET(request: Request) {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin, user, role, seenAt } = await who();
    if (!admin) return NextResponse.json({ elementi: [], nonLette: 0 });
    const url = new URL(request.url);
    const soloConteggio = url.searchParams.get("conteggio") === "1";

    if (role === "admin") {
      const unread = await admin.from("notifications").select("id", { count: "exact", head: true }).in("event", ["created", "signup"]).is("read_at", null);
      if (soloConteggio) return NextResponse.json({ nonLette: unread.count ?? 0, ruolo: "admin" });
      const { data } = await admin.from("notifications").select("id, title, body, url, read_at, created_at").in("event", ["created", "signup"]).order("created_at", { ascending: false }).limit(50);
      const elementi: Item[] = (data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, url: row.url, createdAt: row.created_at, letta: Boolean(row.read_at), tipo: "prenotazione" }));
      return NextResponse.json({ elementi, nonLette: unread.count ?? 0, ruolo: "admin" });
    }

    // Le notifiche sono solo per chi ha fatto l'accesso.
    if (!user) return NextResponse.json({ elementi: [], nonLette: 0, ruolo: null });

    const localSeen = url.searchParams.get("visto");
    const seen = [seenAt, localSeen && !Number.isNaN(Date.parse(localSeen)) ? localSeen : null]
      .filter(Boolean)
      .sort()
      .pop() ?? new Date(Date.now() - 3 * 86_400_000).toISOString();
    const since = new Date(Date.now() - 14 * 86_400_000).toISOString();

    const [personal, broadcasts] = await Promise.all([
      user
        ? admin.from("customer_notifications").select("id, title, body, url, read_at, created_at").eq("profile_id", user.id).order("created_at", { ascending: false }).limit(30)
        : Promise.resolve({ data: [] as { id: string; title: string; body: string; url: string; read_at: string | null; created_at: string }[] }),
      admin.from("broadcasts").select("id, title, body, url, created_at").gte("created_at", since).gt("sent", 0).order("created_at", { ascending: false }).limit(20),
    ]);
    const elementi: Item[] = [
      ...(personal.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, url: row.url, createdAt: row.created_at, letta: Boolean(row.read_at), tipo: "personale" as const })),
      ...(broadcasts.data ?? []).map((row) => ({ id: row.id, title: row.title, body: row.body, url: row.url, createdAt: row.created_at, letta: row.created_at <= seen, tipo: "salone" as const })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const nonLette = elementi.filter((item) => !item.letta).length;
    if (soloConteggio) return NextResponse.json({ nonLette, ruolo: user ? "customer" : null });
    return NextResponse.json({ elementi, nonLette, ruolo: user ? "customer" : null });
  } catch (error) {
    return jsonError(error);
  }
}

/** Segna come lette: tutte, oppure quelle di un appuntamento (admin che apre una richiesta). */
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin, user, role } = await who();
    if (!admin) return NextResponse.json({ ok: true });
    const body = await request.json().catch(() => ({}));
    const now = new Date().toISOString();
    if (role === "admin") {
      let query = admin.from("notifications").update({ read_at: now }).is("read_at", null);
      if (body.appuntamento) query = query.eq("appointment_id", String(body.appuntamento));
      else if (body.id) query = query.eq("id", String(body.id));
      await query;
      return NextResponse.json({ ok: true });
    }
    if (user) {
      await Promise.all([
        admin.from("customer_notifications").update({ read_at: now }).eq("profile_id", user.id).is("read_at", null),
        admin.from("profiles").update({ notifications_seen_at: now }).eq("id", user.id),
      ]);
    }
    return NextResponse.json({ ok: true, visto: now });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse } from "next/server";
import { isAllowedPushEndpoint, sameOrigin } from "@/lib/security/http";
import { jsonError, requireUser } from "@/lib/server/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** Iscrizione delle clienti alle notifiche: disponibilità, offerte, esito delle richieste. */
export async function GET() {
  return NextResponse.json({ chiavePubblica: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "" });
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireUser();
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ errore: "Il salone non è ancora collegato." }, { status: 503 });
    const body = await request.json();
    const endpoint = String(body.endpoint ?? "");
    if (!isAllowedPushEndpoint(endpoint) || !body.keys?.p256dh || !body.keys?.auth) {
      return NextResponse.json({ errore: "Sottoscrizione non valida." }, { status: 400 });
    }
    const { error } = await admin.from("push_subscriptions").upsert(
      {
        profile_id: user.id,
        endpoint,
        p256dh: body.keys.p256dh,
        auth_key: body.keys.auth,
        user_agent: request.headers.get("user-agent"),
        disabled_at: null,
      },
      { onConflict: "endpoint" },
    );
    if (error) return NextResponse.json({ errore: "Non è stato possibile attivare le notifiche." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireUser();
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ ok: true });
    const body = await request.json().catch(() => ({}));
    await admin.from("push_subscriptions").delete().eq("endpoint", String(body.endpoint ?? "")).eq("profile_id", user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

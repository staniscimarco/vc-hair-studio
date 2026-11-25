import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { ensureDatabase } from "@/lib/server/schema";

export const runtime = "nodejs";

/** Link segreto del calendario da abbonare; POST lo rigenera (il vecchio smette di funzionare). */
export async function GET() {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("salon_settings").select("admin_calendar_token").eq("id", 1).maybeSingle();
    if (error || !data) return NextResponse.json({ errore: "Calendario non ancora disponibile." }, { status: 503 });
    return NextResponse.json({ token: data.admin_calendar_token });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const token = crypto.randomUUID().replace(/-/g, "");
    const { error } = await admin.from("salon_settings").update({ admin_calendar_token: token }).eq("id", 1);
    if (error) return NextResponse.json({ errore: "Non è stato possibile rigenerare il link." }, { status: 500 });
    return NextResponse.json({ token });
  } catch (error) {
    return jsonError(error);
  }
}

import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError } from "@/lib/server/guard";
import { limitRequests } from "@/lib/server/notices";
import { ensureDatabase } from "@/lib/server/schema";
import { notifyPendingSignups } from "@/lib/server/signups";

export const runtime = "nodejs";

/** Chiamato subito dopo una registrazione: avvisa l'amministratrice delle nuove richieste da approvare. */
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "sconosciuto";
    await limitRequests(`registrazione:${ip}`, 10);
    await ensureDatabase().catch(() => undefined);
    await notifyPendingSignups();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

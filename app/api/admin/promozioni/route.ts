import { NextResponse } from "next/server";
import { z } from "zod";
import { isIsoDate } from "@/lib/availability/time";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { ensureDatabase } from "@/lib/server/schema";
import { mapPromotion } from "@/lib/server/promotions";
import { broadcastToCustomers } from "@/lib/server/push";

export const runtime = "nodejs";

const schema = z.object({
  id: z.string().uuid().optional(),
  titolo: z.string().trim().min(2, "Scrivi il titolo della promozione.").max(40),
  sottotitolo: z.string().trim().max(90).default(""),
  badge: z.string().trim().max(12).default(""),
  sconto: z.number().int().min(0).max(90),
  servizi: z.array(z.string().uuid()).default([]),
  dal: z.string(),
  al: z.string(),
  attiva: z.boolean().default(true),
  notifica: z.boolean().default(false),
});

export async function GET() {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("promotions").select("*").order("starts_on", { ascending: false });
    if (error) return NextResponse.json({ errore: "Le promozioni non sono ancora disponibili: riprova tra poco." }, { status: 503 });
    return NextResponse.json({ promozioni: (data ?? []).map(mapPromotion) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: parsed.error.issues[0]?.message ?? "Dati non validi." }, { status: 400 });
    const input = parsed.data;
    if (!isIsoDate(input.dal) || !isIsoDate(input.al) || input.al < input.dal) {
      return NextResponse.json({ errore: "Controlla le date: la fine deve essere uguale o successiva all'inizio." }, { status: 400 });
    }
    const row = {
      title: input.titolo,
      subtitle: input.sottotitolo,
      badge: input.badge || (input.sconto ? `-${input.sconto}%` : ""),
      discount_percent: input.sconto,
      service_ids: input.servizi,
      starts_on: input.dal,
      ends_on: input.al,
      active: input.attiva,
    };
    const saved = input.id
      ? await admin.from("promotions").update(row).eq("id", input.id).select("*").single()
      : await admin.from("promotions").insert(row).select("*").single();
    if (saved.error || !saved.data) return NextResponse.json({ errore: "Non è stato possibile salvare la promozione." }, { status: 500 });
    let notifica = null;
    if (input.notifica && input.attiva) {
      notifica = await broadcastToCustomers(admin, {
        kind: "promozione",
        title: `${input.titolo}${input.sconto ? ` · -${input.sconto}%` : ""} 🖤`,
        body: input.sottotitolo || "Approfitta della promozione e prenota il tuo momento di bellezza.",
        url: "/prenota",
        dedupeKey: `promozione:${saved.data.id}`,
      });
    }
    return NextResponse.json({ promozione: mapPromotion(saved.data), notifica });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ errore: "Promozione non indicata." }, { status: 400 });
    await admin.from("promotions").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

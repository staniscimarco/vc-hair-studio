import { NextResponse } from "next/server";
import { serviceSchema } from "@/lib/validators";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from("services").select("*").order("sort_order");
    if (error) return NextResponse.json({ errore: "Non è stato possibile leggere i trattamenti." }, { status: 500 });
    return NextResponse.json({ servizi: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const body = await request.json();
    const parsed = serviceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ errore: parsed.error.issues[0]?.message ?? "Dati non validi." }, { status: 400 });
    const payload = {
      name: parsed.data.nome,
      description: parsed.data.descrizione,
      duration_minutes: parsed.data.durataMinuti,
      prep_minutes: parsed.data.preparazioneMinuti,
      buffer_minutes: parsed.data.intervalloMinuti,
      price_cents: parsed.data.prezzoCentesimi,
      color: parsed.data.colore,
      active: parsed.data.attivo,
      visible: parsed.data.visibile,
      sort_order: parsed.data.ordine,
    };
    const query = body.id
      ? admin.from("services").update(payload).eq("id", body.id)
      : admin.from("services").insert(payload);
    const { error } = await query;
    if (error) return NextResponse.json({ errore: "Non è stato possibile salvare il trattamento." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

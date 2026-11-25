import { NextResponse } from "next/server";
import { z } from "zod";
import { isIsoDate } from "@/lib/availability/time";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { saveUnavailability } from "@/lib/server/unavailability";

const schema = z.object({
  kind: z.enum(["block", "extra_opening", "full_day_closure", "reopen_day"]),
  startDate: z.string(),
  endDate: z.string(),
  allDay: z.boolean(),
  startMin: z.number().int().nullable(),
  endMin: z.number().int().nullable(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "weekdays"]).nullable().optional(),
  weekdays: z.array(z.number().int()).optional(),
  untilDate: z.string().nullable().optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
  resolution: z.object({
    action: z.enum(["annulla", "sposta"]),
    appointments: z.array(z.object({ id: z.string().uuid(), start: z.string().optional() })),
  }).optional(),
});

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const [rules, exceptions, hours] = await Promise.all([
      admin.from("recurrence_rules").select("*").order("start_date"),
      admin.from("availability_exceptions").select("*").order("start_date", { ascending: false }).limit(100),
      admin.from("working_hours").select("*").order("weekday"),
    ]);
    return NextResponse.json({ regole: rules.data ?? [], eccezioni: exceptions.data ?? [], orari: hours.data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { user } = await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success || !isIsoDate(parsed.data.startDate) || !isIsoDate(parsed.data.endDate)) {
      return NextResponse.json({ errore: "Controlla le date dell'indisponibilità." }, { status: 400 });
    }
    const saved = await saveUnavailability({ actorId: user.id, ...parsed.data, untilDate: parsed.data.untilDate ?? null });
    return NextResponse.json(saved);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const tipo = url.searchParams.get("tipo");
    if (!id) return NextResponse.json({ errore: "Elemento non indicato." }, { status: 400 });
    const table = tipo === "regola" ? "recurrence_rules" : "availability_exceptions";
    const { error } = await admin.from(table).delete().eq("id", id);
    if (error) return NextResponse.json({ errore: "Non è stato possibile eliminare il blocco." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

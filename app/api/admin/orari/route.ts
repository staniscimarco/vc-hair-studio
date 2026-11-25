import { NextResponse } from "next/server";
import { z } from "zod";
import { isIsoDate } from "@/lib/availability/time";
import { spanFor } from "@/lib/server/unavailability";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";

const schema = z.object({
  giorni: z.array(z.object({
    weekday: z.number().int().min(1).max(7),
    startMin: z.number().int(),
    endMin: z.number().int(),
  })),
});

export async function PUT(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    await requireAdmin();
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: "Controlla gli orari." }, { status: 400 });
    const admin = createAdminSupabase()!;
    const removed = await admin.from("working_hours").delete().gte("weekday", 1);
    if (removed.error) return NextResponse.json({ errore: "Non è stato possibile aggiornare gli orari." }, { status: 500 });
    if (parsed.data.giorni.length) {
      const { error } = await admin.from("working_hours").insert(
        parsed.data.giorni.map((row) => ({ weekday: row.weekday, start_minute: row.startMin, end_minute: row.endMin })),
      );
      if (error) return NextResponse.json({ errore: "Non è stato possibile salvare gli orari." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const body = z.object({ data: z.string(), azione: z.enum(["chiudi", "riapri"]) }).safeParse(await request.json());
    if (!body.success || !isIsoDate(body.data.data)) return NextResponse.json({ errore: "Data non valida." }, { status: 400 });
    if (body.data.azione === "riapri") {
      await admin.from("availability_exceptions").delete().eq("kind", "full_day_closure").eq("start_date", body.data.data).eq("end_date", body.data.data);
      return NextResponse.json({ ok: true });
    }
    const created = await admin.from("availability_exceptions").insert({
      kind: "full_day_closure",
      start_date: body.data.data,
      end_date: body.data.data,
      all_day: true,
      reason: "chiusura_straordinaria",
    }).select("id").single();
    if (created.error || !created.data) return NextResponse.json({ errore: "Non è stato possibile chiudere la giornata." }, { status: 500 });
    const span = spanFor(body.data.data, true, null, null);
    if (span) {
      await admin.from("blocked_slots").insert({ ...span, exception_id: created.data.id, reason: "chiusura_straordinaria" });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

import { ensureDatabase } from "@/lib/server/schema";
import { NextResponse } from "next/server";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { buildCalendar, salonEvent, salonSelect } from "@/lib/ics";

/** Un singolo appuntamento come file .ics da aggiungere al calendario dell'iPhone. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await ensureDatabase().catch(() => undefined);
    const { id } = await context.params;
    const { admin } = await requireAdmin();
    const [{ data }, settings] = await Promise.all([
      admin.from("appointments").select(salonSelect).eq("id", id).maybeSingle(),
      admin.from("salon_settings").select("address, city").eq("id", 1).maybeSingle(),
    ]);
    if (!data) return NextResponse.json({ errore: "Appuntamento non trovato." }, { status: 404 });
    const place = [settings.data?.address, settings.data?.city].filter(Boolean).join(", ");
    const body = buildCalendar([salonEvent(data as never, place)]);
    return new NextResponse(body, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `inline; filename="appuntamento-${data.code}.ics"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

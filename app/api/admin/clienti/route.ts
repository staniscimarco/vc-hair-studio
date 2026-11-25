import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { adminProfileIds } from "@/lib/server/admins";

export async function GET(request: Request) {
  try {
    const { admin } = await requireAdmin();
    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    const [{ data, error }, admins] = await Promise.all([
      admin.from("customers").select("*").order("last_name").limit(500),
      adminProfileIds(admin),
    ]);
    if (error) return NextResponse.json({ errore: "Non è stato possibile leggere le clienti." }, { status: 500 });
    const hidden = new Set(admins);
    const rows = (data ?? []).filter((row) => !(row.profile_id && hidden.has(String(row.profile_id)))).filter((row) => {
      const haystack = `${row.first_name} ${row.last_name} ${row.email ?? ""} ${row.phone ?? ""}`.toLowerCase();
      return !q || haystack.includes(q);
    });
    return NextResponse.json({ clienti: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const body = await request.json();
    if (body.azione === "anonimizza") {
      const { error } = await admin.from("customers").update({
        first_name: "Cliente",
        last_name: "rimosso",
        email: null,
        phone: null,
        notes: null,
        archived_at: new Date().toISOString(),
      }).eq("id", body.id);
      if (error) return NextResponse.json({ errore: "Non è stato possibile anonimizzare la scheda." }, { status: 500 });
      return NextResponse.json({ ok: true });
    }
    if (body.azione === "collega" && body.email) {
      const profile = await admin.from("profiles").select("id").eq("email", body.email).maybeSingle();
      if (!profile.data) return NextResponse.json({ errore: "Nessun profilo verificato con questa e-mail." }, { status: 404 });
      const { error } = await admin.from("customers").update({ profile_id: profile.data.id }).eq("id", body.id).is("profile_id", null);
      if (error) return NextResponse.json({ errore: "Non è stato possibile collegare il profilo." }, { status: 409 });
      return NextResponse.json({ ok: true });
    }
    const { error } = await admin.from("customers").update({
      first_name: body.nome,
      last_name: body.cognome,
      email: body.email || null,
      phone: body.telefono || null,
      notes: body.note ?? null,
      archived_at: body.archiviata ? new Date().toISOString() : null,
    }).eq("id", body.id);
    if (error) return NextResponse.json({ errore: "Non è stato possibile aggiornare la cliente." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

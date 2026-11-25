import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { adminProfileIds } from "@/lib/server/admins";
import { approveProfile, deleteRegistration } from "@/lib/server/signups";
import { ensureDatabase } from "@/lib/server/schema";

export async function GET(request: Request) {
  try {
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
    const [{ data, error }, admins] = await Promise.all([
      admin.from("customers").select("*").order("created_at", { ascending: false }).limit(500),
      adminProfileIds(admin),
    ]);
    if (error) return NextResponse.json({ errore: "Non è stato possibile leggere le clienti." }, { status: 500 });
    const hidden = new Set(admins);
    const rows = (data ?? []).filter((row) => !(row.profile_id && hidden.has(String(row.profile_id)))).filter((row) => {
      const haystack = `${row.first_name} ${row.last_name} ${row.email ?? ""} ${row.phone ?? ""}`.toLowerCase();
      return !q || haystack.includes(q);
    });
    // Stato di approvazione dei profili registrati online.
    const profileIds = rows.map((row) => row.profile_id).filter(Boolean) as string[];
    const approvals = new Map<string, string | null>();
    const details = new Map<string, { phone?: string; address?: string; email?: string }>();
    if (profileIds.length) {
      const profiles = await admin.from("profiles").select("id, approved_at, phone, address, email").in("id", profileIds);
      if (!profiles.error) {
        for (const row of (profiles.data ?? []) as { id: string; approved_at?: string | null; phone?: string; address?: string; email?: string }[]) {
          approvals.set(String(row.id), row.approved_at ?? null);
          details.set(String(row.id), row);
        }
      }
    }
    const clienti = rows.map((row) => {
      // Telefono e indirizzo: dalla scheda o, se mancano, dal profilo (es. registrazioni con Google).
      const profile = row.profile_id ? details.get(String(row.profile_id)) : undefined;
      return {
        ...row,
        phone: row.phone || profile?.phone || null,
        address: row.address || profile?.address || null,
        email: row.email || profile?.email || null,
        in_attesa: Boolean(row.profile_id && approvals.has(String(row.profile_id)) && !approvals.get(String(row.profile_id))),
      };
    });
    return NextResponse.json({ clienti });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin } = await requireAdmin();
    const body = await request.json();
    if (body.azione === "approva" && body.id) {
      const customer = await admin.from("customers").select("profile_id").eq("id", body.id).maybeSingle();
      if (!customer.data?.profile_id) return NextResponse.json({ errore: "Questa scheda non ha un account da approvare." }, { status: 400 });
      const result = await approveProfile(String(customer.data.profile_id));
      if (!result.ok) return NextResponse.json({ errore: "Profilo già approvato o non trovato." }, { status: 409 });
      return NextResponse.json({ ok: true, dispositivi: result.dispositivi });
    }
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

/** Elimina una registrazione (anche Google): la persona potrà registrarsi di nuovo. */
export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ errore: "Cliente non indicata." }, { status: 400 });
    const result = await deleteRegistration(id);
    if (!result.ok) return NextResponse.json({ errore: result.errore }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

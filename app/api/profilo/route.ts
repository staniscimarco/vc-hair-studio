import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireUser } from "@/lib/server/guard";
import { ensureDatabase } from "@/lib/server/schema";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { fullAddress, profileSchema, streetOf } from "@/lib/validators";

export const runtime = "nodejs";

/** Profilo della persona collegata, letto sul server (funziona anche dopo l'accesso con Google). */
export async function GET() {
  try {
    await ensureDatabase().catch(() => undefined);
    const { user } = await requireUser();
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ errore: "Il salone non è ancora collegato." }, { status: 503 });
    const { data } = await admin.from("profiles").select("first_name, last_name, phone, email, address").eq("id", user.id).maybeSingle();
    const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string };
    const fallback = (meta.full_name || meta.name || "").trim().split(/\s+/);
    return NextResponse.json({
      nome: data?.first_name || fallback[0] || "",
      cognome: data?.last_name || fallback.slice(1).join(" ") || "",
      telefono: data?.phone ?? "",
      email: data?.email || user.email || "",
      indirizzo: streetOf((data as { address?: string } | null)?.address),
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    await ensureDatabase().catch(() => undefined);
    const { user } = await requireUser();
    const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ errore: issue?.message ?? "Controlla i dati.", campo: String(issue?.path[0] ?? "") }, { status: 400 });
    }
    const admin = createAdminSupabase();
    if (!admin) return NextResponse.json({ errore: "Il salone non è ancora collegato." }, { status: 503 });
    const values = {
      first_name: parsed.data.nome,
      last_name: parsed.data.cognome,
      phone: parsed.data.telefono,
      address: fullAddress(parsed.data.indirizzo),
    };
    const { data, error } = await admin.from("profiles").update(values).eq("id", user.id).select("id").maybeSingle();
    if (error) return NextResponse.json({ errore: "Non è stato possibile salvare il profilo. Riprova." }, { status: 500 });
    if (!data) {
      // Profilo mancante (es. creato prima dell'aggiornamento): lo crea ora.
      const created = await admin.from("profiles").insert({ id: user.id, role: "customer", email: user.email ?? "", ...values }).select("id").maybeSingle();
      if (created.error) return NextResponse.json({ errore: "Non è stato possibile creare il profilo." }, { status: 500 });
      await admin.from("customers").insert({
        profile_id: user.id,
        first_name: values.first_name,
        last_name: values.last_name,
        phone: values.phone,
        email: user.email ?? null,
        address: values.address,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

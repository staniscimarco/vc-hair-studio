import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin } from "@/lib/security/http";
import { jsonError, requireAdmin } from "@/lib/server/guard";
import { passwordSchema } from "@/lib/validators";
import { ensureDatabase } from "@/lib/server/schema";

export const runtime = "nodejs";

const createSchema = z.object({
  nome: z.string().trim().min(2, "Inserisci il nome.").max(80),
  email: z.string().trim().toLowerCase().email("Inserisci un indirizzo e-mail valido.").max(160),
  password: passwordSchema,
});

/** Elenco degli amministratori (non compaiono tra i clienti). */
export async function GET() {
  try {
    const { admin, user } = await requireAdmin();
    const { data } = await admin.from("profiles").select("id, first_name, last_name, email, created_at").eq("role", "admin").order("created_at");
    return NextResponse.json({
      amministratori: (data ?? []).map((row) => ({
        id: row.id,
        nome: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Amministratore",
        email: row.email,
        io: row.id === user.id,
      })),
    });
  } catch (error) {
    return jsonError(error);
  }
}

/** Crea un nuovo accesso con e-mail e password e gli dà il ruolo di amministratore. */
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    await ensureDatabase().catch(() => undefined);
    const { admin } = await requireAdmin();
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ errore: parsed.error.issues[0]?.message ?? "Controlla i dati." }, { status: 400 });
    const [firstName, ...rest] = parsed.data.nome.split(/\s+/);

    let userId: string | null = null;
    const created = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: rest.join(" "), privacy_accepted: "true" },
    });
    if (created.data.user) userId = created.data.user.id;
    else {
      // E-mail già registrata (es. una cliente): la promuove ad amministratore e aggiorna la password.
      const existing = await admin.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
      if (!existing.data) {
        return NextResponse.json({ errore: "Non è stato possibile creare l'accesso. Controlla l'e-mail e riprova." }, { status: 400 });
      }
      userId = String(existing.data.id);
      await admin.auth.admin.updateUserById(userId, { password: parsed.data.password, email_confirm: true });
    }

    // Il profilo viene creato in automatico alla registrazione: se non c'è ancora, lo crea qui.
    const profile = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (!profile.data) {
      await admin.from("profiles").insert({ id: userId, role: "admin", first_name: firstName, last_name: rest.join(" "), email: parsed.data.email });
    } else {
      const now = new Date().toISOString();
      const { error } = await admin.from("profiles").update({ role: "admin", first_name: firstName, last_name: rest.join(" "), approved_at: now, signup_notified_at: now }).eq("id", userId);
      if (error) return NextResponse.json({ errore: "Accesso creato, ma non è stato possibile renderlo amministratore." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

/** Toglie il ruolo di amministratore (non a se stessi, e ne resta sempre almeno uno). */
export async function DELETE(request: Request) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
    const { admin, user } = await requireAdmin();
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return NextResponse.json({ errore: "Amministratore non indicato." }, { status: 400 });
    if (id === user.id) return NextResponse.json({ errore: "Non puoi togliere il ruolo a te stessa." }, { status: 400 });
    const { count } = await admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return NextResponse.json({ errore: "Deve restare almeno un amministratore." }, { status: 400 });
    const { error } = await admin.from("profiles").update({ role: "customer" }).eq("id", id);
    if (error) return NextResponse.json({ errore: "Operazione non riuscita." }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

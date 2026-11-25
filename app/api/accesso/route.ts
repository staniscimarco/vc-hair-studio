import { NextResponse } from "next/server";
import { isAdminIdentifier, prepareAdminLogin } from "@/lib/server/admin-account";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const identificativo = String(body?.email ?? "").trim();
    const password = String(body?.password ?? "");
    if (!identificativo || !password) {
      return NextResponse.json({ errore: "Inserisci e-mail o nome utente e la parola d'ordine." }, { status: 400 });
    }

    let email = identificativo;
    if (isAdminIdentifier(identificativo)) {
      const prepared = await prepareAdminLogin(password);
      if (!prepared.ok) return NextResponse.json({ errore: prepared.errore }, { status: prepared.status });
      email = prepared.email;
    }

    const supabase = await createServerSupabase();
    if (!supabase) return NextResponse.json({ errore: "L'accesso non è ancora configurato." }, { status: 503 });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ errore: "E-mail o parola d'ordine non corrette." }, { status: 401 });

    const { data } = await supabase.auth.getUser();
    const profile = data.user
      ? await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
      : { data: null };
    const ruolo = profile?.data?.role ?? "customer";
    return NextResponse.json({ ok: true, ruolo, prossimo: ruolo === "admin" ? "/admin" : "/" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Non è stato possibile accedere.";
    return NextResponse.json({ errore: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/security/http";
import { ensureDatabase } from "@/lib/server/schema";
import { notifyPendingSignups } from "@/lib/server/signups";

/**
 * Ritorno da Google o dal link di conferma e-mail: crea la sessione.
 * Se mancano telefono o indirizzo (accesso con Google), chiede di completarli nel profilo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"), "/");
  const providerError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (providerError) {
    return NextResponse.redirect(new URL(`/accesso?errore=${encodeURIComponent("Accesso con Google non riuscito. Riprova.")}`, url.origin));
  }
  if (!code) return NextResponse.redirect(new URL(next, url.origin));

  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL(next, url.origin));
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(new URL(`/accesso?errore=${encodeURIComponent("Il collegamento è scaduto o non è valido. Accedi di nuovo.")}`, url.origin));
  }

  await ensureDatabase().catch(() => undefined);
  // Nuova registrazione (anche con Google): l'amministratrice riceve subito la notifica.
  await notifyPendingSignups().catch(() => undefined);
  const profile = await supabase.from("profiles").select("role, phone, address").eq("id", data.user.id).maybeSingle();
  const row = profile.data as { role?: string; phone?: string; address?: string } | null;
  if (row?.role === "admin") return NextResponse.redirect(new URL(next === "/" ? "/admin" : next, url.origin));
  if (row && (!row.phone || !row.address)) {
    return NextResponse.redirect(new URL(`/profilo?completa=1&prossimo=${encodeURIComponent(next)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}

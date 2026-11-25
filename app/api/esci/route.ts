import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/security/http";
import { createServerSupabase } from "@/lib/supabase/server";

/** Esce dall'account cancellando la sessione anche lato server (cookie). */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ errore: "Richiesta non consentita." }, { status: 403 });
  const supabase = await createServerSupabase();
  if (supabase) await supabase.auth.signOut().catch(() => undefined);
  return NextResponse.json({ ok: true });
}

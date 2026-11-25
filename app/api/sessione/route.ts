import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isApproved } from "@/lib/server/signups";

export async function GET() {
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ autenticato: false, ruolo: null, nome: "" });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ autenticato: false, ruolo: null, nome: "" });
  const profile = await supabase.from("profiles").select("role, first_name").eq("id", data.user.id).maybeSingle();
  const ruolo = profile.data?.role ?? "customer";
  return NextResponse.json({
    autenticato: true,
    ruolo,
    nome: profile.data?.first_name ?? "",
    // Le nuove registrazioni restano in attesa finché il salone non le approva.
    approvato: ruolo === "admin" ? true : await isApproved(data.user.id),
  });
}

import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.json({ autenticato: false, ruolo: null, nome: "" });
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ autenticato: false, ruolo: null, nome: "" });
  const profile = await supabase.from("profiles").select("role, first_name").eq("id", data.user.id).maybeSingle();
  return NextResponse.json({
    autenticato: true,
    ruolo: profile.data?.role ?? "customer",
    nome: profile.data?.first_name ?? "",
  });
}

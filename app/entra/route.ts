import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await createServerSupabase();
  if (!supabase) return NextResponse.redirect(new URL("/", url.origin));
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/", url.origin));
  const profile = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  // L'app installata si apre sulla dashboard del salone per l'admin, sulla home per le clienti.
  const destination = profile.data?.role === "admin" ? "/admin" : "/";
  return NextResponse.redirect(new URL(destination, url.origin));
}

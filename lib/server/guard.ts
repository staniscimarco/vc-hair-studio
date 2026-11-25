import { NextResponse } from "next/server";
import { ConflictError, HttpError } from "@/lib/http";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";

export function jsonError(error: unknown) {
  if (error instanceof ConflictError) {
    return NextResponse.json(
      { errore: error.message, appuntamenti: error.appointments },
      { status: 409 },
    );
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ errore: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ errore: "Si è verificato un errore imprevisto." }, { status: 500 });
}

export async function requireUser() {
  const supabase = await createServerSupabase();
  if (!supabase) throw new HttpError(503, "L'accesso non è ancora configurato.");
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Accedi per continuare.");
  return { supabase, user: data.user };
}

export async function requireAdmin() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("profiles")
    .select("role, first_name, last_name")
    .eq("id", user.id)
    .single();
  if (error || data?.role !== "admin") {
    throw new HttpError(403, "Questa area è riservata al salone.");
  }
  const admin = createAdminSupabase();
  if (!admin) throw new HttpError(503, "Manca la chiave di servizio per le operazioni del salone.");
  return { supabase, admin, user, profile: data };
}

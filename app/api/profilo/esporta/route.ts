import { NextResponse } from "next/server";
import { customerForUser } from "@/lib/server/bookings";
import { jsonError, requireUser } from "@/lib/server/guard";
import { createAdminSupabase } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { user } = await requireUser();
    const customer = await customerForUser(user.id);
    const admin = createAdminSupabase();
    const appointments = await admin!
      .from("appointments")
      .select("id, code, starts_at, ends_at, status, price_cents, service_id")
      .eq("customer_id", customer.id);
    return NextResponse.json({
      profilo: {
        nome: customer.first_name,
        cognome: customer.last_name,
        email: customer.email,
        telefono: customer.phone,
      },
      appuntamenti: appointments.data ?? [],
    });
  } catch (error) {
    return jsonError(error);
  }
}

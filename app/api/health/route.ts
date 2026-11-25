import { NextResponse } from "next/server";
import { isServiceRoleConfigured, isSupabaseConfigured } from "@/lib/supabase/env";

export async function GET() {
  return NextResponse.json({
    stato: "ok",
    supabase: isSupabaseConfigured(),
    servizio: isServiceRoleConfigured(),
    email: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    notifiche: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
  });
}

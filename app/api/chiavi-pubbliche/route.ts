import { NextResponse } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export function GET() {
  const url = supabaseUrl();
  const chiave = supabasePublishableKey();
  if (!url || !chiave) return NextResponse.json({ url: "", chiave: "" });
  return NextResponse.json({ url, chiave });
}

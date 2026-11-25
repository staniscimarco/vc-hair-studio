import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/env";

export async function createServerSupabase() {
  const url = supabaseUrl();
  const key = supabasePublishableKey();
  if (!url || !key || !isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // In un Server Component la sessione viene aggiornata dal proxy.
          }
        },
      },
    },
  );
}

"use client";

import { getBrowserSupabase } from "@/lib/supabase/browser";

/** Esce dall'account (server e browser) e torna alla pagina di accesso. */
export async function logout() {
  await fetch("/api/esci", { method: "POST" }).catch(() => undefined);
  await (await getBrowserSupabase())?.auth.signOut().catch(() => undefined);
  try {
    sessionStorage.clear();
  } catch {
    // Archiviazione non disponibile.
  }
  // Ricaricamento completo voluto: azzera ogni stato della sessione precedente.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign("/accesso");
}

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Provider = "google";

/**
 * Accesso con Google (Gmail). Il provider va attivato
 * nel pannello Supabase: Authentication → Providers.
 */
export function SocialButtons({ next, label = "Continua" }: { next: string; label?: string }) {
  const [busy, setBusy] = useState<Provider | null>(null);

  async function signIn(provider: Provider) {
    setBusy(provider);
    const supabase = await getBrowserSupabase();
    if (!supabase) {
      toast.error("L'accesso non è ancora configurato.");
      setBusy(null);
      return;
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      toast.error("L'accesso con Google non è ancora attivo per questo salone.");
      setBusy(null);
    }
  }

  return (
    <div className="social-grid">
      <button className="btn-social" type="button" disabled={busy !== null} onClick={() => void signIn("google")}>
        <GoogleMark /> {busy === "google" ? "Apertura di Google…" : `${label} con Google`}
      </button>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}


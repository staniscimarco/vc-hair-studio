"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let pending: Promise<SupabaseClient | null> | null = null;

export function getBrowserSupabase(): Promise<SupabaseClient | null> {
  pending ??= fetch("/api/chiavi-pubbliche")
    .then((response) => response.json())
    .then((body: { url?: string; chiave?: string }) => {
      if (!body.url || !body.chiave) {
        pending = null;
        return null;
      }
      return createBrowserClient(body.url, body.chiave);
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { notifyLive } from "@/lib/live";

/**
 * Collega il service worker all'app aperta:
 * - notifica arrivata → i dati si aggiornano subito;
 * - tocco sulla notifica → si apre la pagina giusta (prenota, appuntamenti, richiesta…).
 */
export function ServiceWorkerBridge() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (!data?.type) return;
      if (data.type === "push") notifyLive();
      if (data.type === "apri" && data.url) {
        const target = new URL(data.url, window.location.origin);
        if (target.origin === window.location.origin) router.push(`${target.pathname}${target.search}`);
        notifyLive();
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    // Aperta dal tocco su una notifica quando l'app era chiusa: ?da_notifica=1
    const params = new URLSearchParams(window.location.search);
    if (params.has("da_notifica")) {
      params.delete("da_notifica");
      const query = params.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
      notifyLive();
    }
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  return null;
}

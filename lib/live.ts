"use client";

import { useEffect, useRef } from "react";

/** Evento interno: "qualcosa è cambiato, ricarica i dati" (notifica arrivata, letture, salvataggi). */
export const LIVE_EVENT = "vc-live";

export function notifyLive() {
  window.dispatchEvent(new Event(LIVE_EVENT));
}

/**
 * Tiene i dati aggiornati in tempo reale: ricarica quando arriva una notifica push,
 * quando l'app torna in primo piano e, mentre è aperta, ogni `intervalMs`.
 */
export function useLive(refresh: () => void, intervalMs = 20_000) {
  const callback = useRef(refresh);
  useEffect(() => {
    callback.current = refresh;
  });

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === "visible") callback.current();
    };
    const onVisibility = () => run();
    window.addEventListener(LIVE_EVENT, run);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisibility);
    const timer = window.setInterval(run, intervalMs);
    return () => {
      window.removeEventListener(LIVE_EVENT, run);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}

const SEEN_KEY = "vc-notifiche-viste";

export function localSeen() {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function markLocalSeen(value = new Date().toISOString()) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Archiviazione non disponibile.
  }
}

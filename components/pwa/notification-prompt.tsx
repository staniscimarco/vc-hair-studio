"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, CalendarCheck, Sparkles, Tag, X } from "lucide-react";
import { enablePush, pushSupported, saveSubscription } from "@/lib/push-client";

const SNOOZE_KEY = "vc-notifiche-rimandate";
const SNOOZE_HOURS = 24;

function snoozed() {
  try {
    return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_HOURS * 3_600_000;
  } catch {
    return false;
  }
}

/**
 * All'apertura dell'app chiede di attivare le notifiche (con un tocco, come richiede iPhone).
 * Se il permesso è già concesso, registra il dispositivo in silenzio.
 */
export function NotificationPrompt() {
  const pathname = usePathname();
  const [role, setRole] = useState<"admin" | "customer" | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    let cancelled = false;
    let timer: number | undefined;
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then((session: { autenticato: boolean; ruolo: "admin" | "customer" | null; approvato?: boolean }) => {
        if (cancelled || !session.autenticato) return;
        const current = session.autenticato && session.ruolo === "admin" ? "admin" : "customer";
        setRole(current);
        if (Notification.permission === "granted") {
          const key = `vc-push-salvato-${current}-${session.autenticato ? "1" : "0"}`;
          try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
          } catch {
            // Archiviazione non disponibile: registra comunque.
          }
          void saveSubscription(current);
          return;
        }
        if (Notification.permission === "denied" || snoozed()) return;
        // Il popup automatico compare nell'app installata (iPhone e Android); per l'admin anche dal browser.
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone === true;
        // Nel browser la chiediamo all'admin e a chi aspetta l'approvazione (così sa quando può prenotare).
        if (!standalone && current !== "admin" && session.approvato !== false) return;
        // Aspetta che lo splash e l'eventuale popup di installazione siano chiusi.
        const tryOpen = () => {
          if (cancelled) return;
          if (document.querySelector(".install-sheet, .splash")) timer = window.setTimeout(tryOpen, 2000);
          else setOpen(true);
        };
        timer = window.setTimeout(tryOpen, 3200);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [pathname]);

  if (!open || !role) return null;

  function later() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      // Archiviazione non disponibile.
    }
    setOpen(false);
  }

  async function enable() {
    if (!role) return;
    setBusy(true);
    const result = await enablePush(role).catch(() => ({ ok: false, motivo: "Non è stato possibile attivare le notifiche." }));
    setBusy(false);
    if (result.ok) {
      toast.success("Notifiche attivate 💜");
      setOpen(false);
    } else {
      toast.error(result.motivo ?? "Notifiche non attivate.");
      later();
    }
  }

  const perks = role === "admin"
    ? [
        { icon: CalendarCheck, text: "Ogni nuova prenotazione, subito" },
        { icon: BellRing, text: "Accetti o rifiuti con un tocco" },
      ]
    : [
        { icon: CalendarCheck, text: "Conferma del tuo appuntamento" },
        { icon: Sparkles, text: "Posti liberi del giorno" },
        { icon: Tag, text: "Offerte riservate, come il Black Friday" },
      ];

  return (
    <>
      <button className="sheet-scrim" type="button" aria-label="Chiudi" onClick={later} />
      <div className="sheet-panel install-sheet" role="dialog" aria-modal="true" aria-labelledby="notifiche-titolo">
        <div className="sheet-handle" />
        <button className="icon-btn is-soft" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={later}>
          <X size={18} />
        </button>
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="bell-badge"><BellRing size={34} /></span>
          <h2 id="notifiche-titolo">{role === "admin" ? "Non perdere nessuna prenotazione" : "Resta aggiornata, senza pensieri"}</h2>
          <p className="note m-0">
            {role === "admin"
              ? "Attiva le notifiche su questo dispositivo: ti avvisiamo appena una cliente prenota."
              : "Attiva le notifiche: ti avvisiamo quando si libera un posto, delle offerte riservate e, se prenoti, della conferma del salone."}
          </p>
        </div>
        <ul className="install-steps">
          {perks.map((perk) => {
            const Icon = perk.icon;
            return (
              <li key={perk.text}>
                <span className="step-num"><Icon size={15} /></span>
                <span className="grow">{perk.text}</span>
              </li>
            );
          })}
        </ul>
        <button className="btn btn-primary btn-block mt-5" type="button" disabled={busy} onClick={() => void enable()}>
          <BellRing size={18} /> {busy ? "Attivazione…" : "Attiva le notifiche"}
        </button>
        <button className="btn btn-soft btn-block mt-2" type="button" onClick={later}>Più tardi</button>
      </div>
    </>
  );
}

"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BellRing, Download, EllipsisVertical, Share, SquarePlus, X, Zap } from "lucide-react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice?: Promise<{ outcome: string }> };
type Platform = "ios" | "android" | "desktop";

const SNOOZE_KEY = "vc-installazione-rimandata";
const SNOOZE_DAYS = 3;
/** Evento globale per riaprire il popup da un pulsante (profilo, notifiche). */
export const SHOW_INSTALL_EVENT = "vc-mostra-installazione";

export function openInstallHint() {
  window.dispatchEvent(new Event(SHOW_INSTALL_EVENT));
}

function readSnooze() {
  try {
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  } catch {
    return 0;
  }
}

function writeSnooze() {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    // Archiviazione non disponibile (navigazione privata): il popup tornerà alla prossima visita.
  }
}

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  if (/iphone|ipad|ipod/i.test(ua) || iPadOS) return "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export function InstallHint() {
  const pathname = usePathname();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [open, setOpen] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    if (standalone) return;

    const current = detectPlatform();
    setPlatform(current);
    const snoozed = Date.now() - readSnooze() < SNOOZE_DAYS * 86_400_000;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      if (!snoozed) setOpen(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setOpen(false);
    };
    const onShow = () => setOpen(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(SHOW_INSTALL_EVENT, onShow);

    // Su telefono il popup compare dopo qualche secondo anche senza il prompt automatico del browser.
    const timer = !snoozed && current !== "desktop" ? window.setTimeout(() => setOpen(true), 2500) : undefined;

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(SHOW_INSTALL_EVENT, onShow);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  // Non compare durante il rientro dal login esterno.
  if (!open || installed || pathname.startsWith("/auth")) return null;

  function close() {
    writeSnooze();
    setOpen(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice?.catch(() => null);
    setDeferred(null);
    if (choice?.outcome === "accepted") setOpen(false);
  }

  const inAppBrowser = /FBAN|FBAV|Instagram|Line\/|WhatsApp/i.test(typeof navigator === "undefined" ? "" : navigator.userAgent);

  return (
    <>
      <button className="sheet-scrim" type="button" aria-label="Chiudi" onClick={close} />
      <div className="sheet-panel install-sheet" role="dialog" aria-modal="true" aria-labelledby="installa-titolo">
        <div className="sheet-handle" />
        <button className="icon-btn is-soft" style={{ position: "absolute", right: 16, top: 16, width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={close}>
          <X size={18} />
        </button>

        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span className="install-app-icon">
            <Image src="/icons/icon-192.png" alt="" width={72} height={72} unoptimized />
          </span>
          <div>
            <h2 id="installa-titolo">Installa VC Hair Studio</h2>
            <p className="note m-0 mt-1">Aggiungi l&apos;app alla schermata Home: si apre a schermo intero, come un&apos;app vera.</p>
          </div>
          <div className="install-perks">
            <span><Zap size={14} /> Prenoti in un tocco</span>
            <span><BellRing size={14} /> Promemoria</span>
          </div>
        </div>

        {platform === "ios" ? (
          <>
            {inAppBrowser ? (
              <p className="warning-box mt-4">Stai usando il browser di un&apos;altra app. Apri questa pagina in Safari per poterla installare.</p>
            ) : null}
            <ol className="install-steps">
              <li>
                <span className="step-num">1</span>
                <span className="grow">Tocca <strong>Condividi</strong> nella barra di Safari</span>
                <span className="step-icon"><Share size={18} /></span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span className="grow">Scorri e scegli <strong>Aggiungi alla schermata Home</strong></span>
                <span className="step-icon"><SquarePlus size={18} /></span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span className="grow">Tocca <strong>Aggiungi</strong> in alto a destra</span>
                <span className="step-icon text-[12px] font-semibold">Aggiungi</span>
              </li>
            </ol>
            <p className="note mt-3 text-center">Le notifiche su iPhone funzionano dall&apos;app installata, con iOS 16.4 o successivo.</p>
            <button className="btn btn-primary btn-block mt-3" type="button" onClick={close}>Ho capito</button>
          </>
        ) : deferred ? (
          <>
            <button className="btn btn-primary btn-block mt-5" type="button" onClick={() => void install()}>
              <Download size={18} /> Installa l&apos;app
            </button>
            <button className="btn btn-soft btn-block mt-2" type="button" onClick={close}>Non ora</button>
          </>
        ) : (
          <>
            <ol className="install-steps">
              <li>
                <span className="step-num">1</span>
                <span className="grow">Tocca il menu <strong>⋮</strong> in alto a destra di Chrome</span>
                <span className="step-icon"><EllipsisVertical size={18} /></span>
              </li>
              <li>
                <span className="step-num">2</span>
                <span className="grow">Scegli <strong>Installa app</strong> oppure <strong>Aggiungi a schermata Home</strong></span>
                <span className="step-icon"><Download size={18} /></span>
              </li>
              <li>
                <span className="step-num">3</span>
                <span className="grow">Conferma con <strong>Installa</strong></span>
                <span className="step-icon text-[12px] font-semibold">Installa</span>
              </li>
            </ol>
            <button className="btn btn-primary btn-block mt-4" type="button" onClick={close}>Ho capito</button>
          </>
        )}
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";

export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const dismissed = sessionStorage.getItem("vc-installazione-nascosta");
    if (dismissed) return;
    setHidden(false);
    const apple = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(apple);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;

  return (
    <aside className="fixed inset-x-3 bottom-3 z-40 rounded-3xl border border-line bg-white/95 p-4 shadow-[var(--shadow)] backdrop-blur sm:left-auto sm:max-w-sm">
      <p className="font-display text-xl text-cocoa">Installa VC Hair Studio</p>
      {ios ? (
        <p className="mt-2 text-sm leading-6">
          Su iPhone o iPad apri il menu Condividi di Safari e scegli «Aggiungi a Home». Le notifiche si possono attivare dopo l&apos;installazione, da iOS 16.4.
        </p>
      ) : (
        <p className="mt-2 text-sm leading-6">
          Installa l&apos;applicazione per aprire l&apos;agenda dal telefono, anche a schermo intero.
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {deferred ? (
          <button
            className="rounded-full bg-cocoa px-4 py-2 text-sm text-cream"
            type="button"
            onClick={() => void deferred.prompt()}
          >
            Installa l&apos;applicazione
          </button>
        ) : null}
        <button
          className="rounded-full px-4 py-2 text-sm"
          type="button"
          onClick={() => {
            sessionStorage.setItem("vc-installazione-nascosta", "1");
            setHidden(true);
          }}
        >
          Non ora
        </button>
      </div>
    </aside>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

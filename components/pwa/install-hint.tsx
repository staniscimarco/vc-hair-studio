"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

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

  function dismiss() {
    sessionStorage.setItem("vc-installazione-nascosta", "1");
    setHidden(true);
  }

  return (
    <aside className="install-hint" aria-label="Installa l'applicazione">
      <div className="flex items-start gap-3">
        <span className="hero-avatar" style={{ width: 44, height: 44, borderColor: "var(--lavender)" }}>
          <Image src="/brand/vale.png" alt="" width={44} height={44} unoptimized />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[15px] font-semibold text-ink">Installa VC Hair Studio</p>
          <p className="mt-1 text-[13px] leading-5 text-muted">
            {ios
              ? "Su iPhone o iPad apri il menu Condividi di Safari e scegli «Aggiungi a Home». Le notifiche si attivano dopo l'installazione, da iOS 16.4."
              : "Installa l'applicazione per aprire l'agenda dal telefono, anche a schermo intero."}
          </p>
        </div>
        <button className="icon-btn is-soft" style={{ width: 32, height: 32 }} type="button" aria-label="Chiudi" onClick={dismiss}>
          <X size={16} />
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        {deferred ? (
          <button className="btn btn-primary btn-sm flex-1" type="button" onClick={() => void deferred.prompt()}>
            Installa l&apos;applicazione
          </button>
        ) : null}
        <button className="btn btn-soft btn-sm flex-1" type="button" onClick={dismiss}>
          Non ora
        </button>
      </div>
    </aside>
  );
}

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void> };

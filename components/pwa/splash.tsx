"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Deciso una sola volta per caricamento della pagina (anche se l'effetto viene eseguito due volte). */
let alreadySeen: boolean | null = null;

/**
 * Schermata di avvio viola con il logo al centro.
 * Compare all'apertura dell'app (una volta per sessione) e sfuma dopo poco.
 */
export function Splash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    if (alreadySeen === null) {
      try {
        alreadySeen = sessionStorage.getItem("vc-splash") === "1";
        sessionStorage.setItem("vc-splash", "1");
      } catch {
        alreadySeen = false;
      }
    }
    if (alreadySeen) {
      setPhase("gone");
      return;
    }
    const fade = window.setTimeout(() => setPhase("fade"), 1300);
    const gone = window.setTimeout(() => {
      alreadySeen = true;
      setPhase("gone");
    }, 1800);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(gone);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div className={`splash ${phase === "fade" ? "is-fading" : ""}`} aria-hidden>
      <span className="splash-ring r1" />
      <span className="splash-ring r2" />
      <div className="splash-logo">
        <Image src="/brand/vale.png" alt="" width={180} height={180} priority unoptimized />
      </div>
      <p className="splash-name">VC Hair Studio</p>
      <p className="splash-tag">Il tuo momento di bellezza</p>
      <span className="splash-dots"><i /><i /><i /></span>
    </div>
  );
}

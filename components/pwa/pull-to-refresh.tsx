"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 72;
const MAX = 120;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Un elemento che scorre per conto suo (lista, pannello) ha la precedenza sul gesto. */
function scrolledInside(target: EventTarget | null) {
  let node = target instanceof Element ? target : null;
  while (node && node !== document.body) {
    if (node.closest(".sheet-panel, .splash, .fc-scroller")) return true;
    if (node.scrollTop > 0) return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * Nell'app installata (iPhone e Android) trascinando la pagina verso il basso dall'alto
 * si aggiorna l'app: si scarica la versione più recente e si ricaricano i dati.
 */
export function PullToRefresh() {
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!isStandalone()) return;
    setEnabled(true);
    document.documentElement.classList.add("is-standalone");

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || window.scrollY > 0 || scrolledInside(event.target)) {
        start.current = null;
        return;
      }
      start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      active.current = false;
    };

    const onMove = (event: TouchEvent) => {
      if (!start.current) return;
      const dy = event.touches[0].clientY - start.current.y;
      const dx = event.touches[0].clientX - start.current.x;
      if (!active.current) {
        // Parte solo con un gesto chiaramente verticale verso il basso.
        if (dy < 8 || Math.abs(dx) > dy) {
          if (Math.abs(dx) > 8 || dy < -4) start.current = null;
          return;
        }
        active.current = true;
      }
      if (window.scrollY > 0) return;
      event.preventDefault();
      const eased = Math.min(MAX, dy * 0.5);
      pullRef.current = eased;
      setPull(eased);
    };

    const onEnd = async () => {
      if (!active.current) {
        start.current = null;
        return;
      }
      active.current = false;
      start.current = null;
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try {
          const registration = await navigator.serviceWorker?.getRegistration();
          await registration?.update();
        } catch {
          // Anche senza aggiornare il service worker, la pagina viene ricaricata dalla rete.
        }
        window.location.reload();
        return;
      }
      pullRef.current = 0;
      setPull(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  if (!enabled || (pull === 0 && !refreshing)) return null;

  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div className="ptr" style={{ transform: `translate(-50%, ${pull - 52}px)`, opacity: Math.max(0.2, progress) }} aria-live="polite">
      <span className={`ptr-ball ${refreshing ? "is-spinning" : ""}`} style={refreshing ? undefined : { transform: `rotate(${progress * 300}deg)` }}>
        <RefreshCw size={20} strokeWidth={2.4} />
      </span>
      <span className="sr-only">{refreshing ? "Aggiornamento in corso" : progress >= 1 ? "Rilascia per aggiornare" : "Trascina per aggiornare"}</span>
    </div>
  );
}

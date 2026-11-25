"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { localSeen, useLive } from "@/lib/live";

/** Numero di notifiche non lette (admin o cliente), aggiornato in tempo reale. */
export function useUnreadCount() {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    void fetch(`/api/notifiche/centro?conteggio=1&visto=${encodeURIComponent(localSeen())}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { nonLette: 0 }))
      .then((body) => setCount(Number(body.nonLette ?? 0)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load, pathname]);
  useLive(load);

  // Numero anche sull'icona dell'app installata (dove supportato).
  useEffect(() => {
    const nav = navigator as Navigator & { setAppBadge?: (count?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
    if (count > 0) void nav.setAppBadge?.(count).catch(() => undefined);
    else void nav.clearAppBadge?.().catch(() => undefined);
  }, [count]);

  return count;
}

export function CountBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return <span className={`count-badge ${className}`} aria-label={`${count} non lette`}>{count > 99 ? "99+" : count}</span>;
}

/** Campanella con il numero delle notifiche non lette; sparisce quando le leggi. */
export function NotificationBell({ href, tone = "white" }: { href: string; tone?: "white" | "soft" }) {
  const count = useUnreadCount();
  const label = count ? `Notifiche, ${count} non lette` : "Notifiche";
  return (
    <Link href={href} aria-label={label} title={label} className={`icon-btn ${tone === "white" ? "is-white" : "is-soft"}`}>
      <Bell size={20} strokeWidth={2} />
      <CountBadge count={count} />
    </Link>
  );
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, House, Scissors, Store, UserRound } from "lucide-react";
import { NotificationBell } from "@/components/ui/notification-bell";

const items = [
  { href: "/", label: "Home", icon: House },
  { href: "/prenota", label: "Prenota", icon: Scissors },
  { href: "/i-miei-appuntamenti", label: "Appuntamenti", icon: CalendarDays },
  { href: "/profilo", label: "Profilo", icon: UserRound },
];

function isCurrent(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

type Session = { autenticato: boolean; ruolo: "customer" | "admin" | null; nome: string };

/** Desktop: barra superiore con marchio, collegamenti a pillola e azioni. */
export function CustomerTopNav() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then(setSession)
      .catch(() => setSession({ autenticato: false, ruolo: null, nome: "" }));
  }, [pathname]);

  if (pathname.startsWith("/admin")) return null;

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Image src="/brand/vale.png" alt="" width={46} height={46} unoptimized />
          </span>
          VC Hair Studio
        </Link>
        <nav className="topnav-links" aria-label="Navigazione principale">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
                <Icon size={17} strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="topnav-actions">
          {session?.ruolo === "admin" ? (
            <Link className="btn btn-soft btn-sm" href="/admin">Area salone</Link>
          ) : null}
          <NotificationBell href="/notifiche" tone="soft" />
          {session?.autenticato ? (
            <Link className="btn btn-primary btn-sm" href="/prenota">Prenota ora</Link>
          ) : (
            <Link className="btn btn-primary btn-sm" href="/accesso">Accedi</Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Mobile: barra inferiore bianca arrotondata, icona attiva piena viola. */
export function CustomerTabBar() {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    void fetch("/api/sessione")
      .then((response) => response.json())
      .then((body) => setAdmin(body.ruolo === "admin"))
      .catch(() => undefined);
  }, [pathname]);
  if (pathname.startsWith("/admin")) return null;
  // L'amministratrice vede anche la scheda per tornare all'area salone.
  const tabs = admin ? [...items.slice(0, 3), { href: "/admin", label: "Salone", icon: Store }] : items;
  return (
    <nav className="tabbar" aria-label="Navigazione">
      {tabs.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
            <Icon size={23} strokeWidth={1.7} className={item.icon === House || item.icon === UserRound ? "tab-fill" : undefined} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

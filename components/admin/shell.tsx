"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Ban,
  Bell,
  CalendarDays,
  CalendarPlus,
  ChevronRight,
  House,
  ListChecks,
  Plus,
  Scissors,
  Settings,
  Tag,
  Users,
  X,
} from "lucide-react";

/** Mobile: le cinque voci della barra inferiore. */
const tabs = [
  { href: "/admin", label: "Home", icon: House },
  { href: "/admin/calendario", label: "Agenda", icon: CalendarDays },
  { href: "/admin/clienti", label: "Clienti", icon: Users },
  { href: "/admin/notifiche", label: "Notifiche", icon: Bell },
  { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings },
];

/** Desktop: barra laterale completa, raggruppata. */
const groups = [
  {
    label: "Salone",
    items: [
      { href: "/admin", label: "Panoramica", icon: House },
      { href: "/admin/calendario", label: "Agenda", icon: CalendarDays },
      { href: "/admin/appuntamenti", label: "Nuovo appuntamento", icon: CalendarPlus },
      { href: "/admin/clienti", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Gestione",
    items: [
      { href: "/admin/promozioni", label: "Promozioni", icon: Tag },
      { href: "/admin/servizi", label: "Servizi", icon: Scissors },
      { href: "/admin/disponibilita", label: "Disponibilità", icon: Ban },
      { href: "/admin/notifiche", label: "Notifiche", icon: Bell },
      { href: "/admin/impostazioni", label: "Impostazioni", icon: Settings },
      { href: "/admin/configurazione", label: "Prima configurazione", icon: ListChecks },
    ],
  },
];

const quick = [
  { href: "/admin/appuntamenti", label: "Nuovo appuntamento", hint: "Telefonate e richieste in salone", icon: CalendarPlus },
  { href: "/admin/disponibilita", label: "Blocca disponibilità", hint: "Pause, ferie e chiusure", icon: Ban },
  { href: "/admin/promozioni", label: "Nuova promozione", hint: "Black Friday e offerte, con notifica alle clienti", icon: Tag },
  { href: "/admin/servizi", label: "Trattamenti", hint: "Prezzi, durate e visibilità", icon: Scissors },
];

function isCurrent(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-frame">
      <aside className="sidebar" aria-label="Menu amministratore">
        <Link href="/admin" className="brand">
          <span className="brand-mark">
            <Image src="/brand/vale.png" alt="" width={46} height={46} unoptimized />
          </span>
          <span>
            VC Hair Studio
            <small className="block text-[11px] font-medium text-muted">Area salone</small>
          </span>
        </Link>
        {groups.map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <p className="sidebar-label">{group.label}</p>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} className="side-link" href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
                  <Icon size={19} strokeWidth={1.9} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        ))}
        <div className="sidebar-foot">
          <div className="sidebar-promo">
            <strong>Agenda di oggi</strong>
            <p>Inserisci al volo un appuntamento preso al telefono.</p>
            <Link className="btn btn-accent btn-sm w-full" href="/admin/appuntamenti">
              <Plus size={16} /> Nuovo appuntamento
            </Link>
          </div>
          <Link className="side-link mt-3" href="/">
            <House size={19} strokeWidth={1.9} /> Vai al sito clienti
          </Link>
        </div>
      </aside>

      <div className="app-screen">{children}</div>

      <button className="fab" type="button" aria-label="Azioni rapide" onClick={() => setOpen(true)}>
        <Plus size={26} />
      </button>
      {open ? (
        <>
          <button className="sheet-scrim" type="button" aria-label="Chiudi azioni" onClick={() => setOpen(false)} />
          <div className="sheet-panel" role="dialog" aria-label="Azioni rapide">
            <div className="sheet-handle" />
            <div className="flex items-center justify-between">
              <h2>Azioni rapide</h2>
              <button className="icon-btn is-soft" style={{ width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="mt-2">
              {quick.map((item) => {
                const Icon = item.icon;
                return (
                  <Link key={item.label} className="list-row" href={item.href} onClick={() => setOpen(false)}>
                    <span className="tile-icon"><Icon size={19} /></span>
                    <span className="grow">
                      {item.label}
                      <small className="block text-xs font-normal text-muted">{item.hint}</small>
                    </span>
                    <ChevronRight size={18} className="text-muted" />
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
      <nav className="tabbar" aria-label="Navigazione amministratore">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined}>
              <Icon size={23} strokeWidth={1.7} className={item.icon === House ? "tab-fill" : undefined} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CountBadge, useUnreadCount } from "@/components/ui/notification-bell";
import { logout } from "@/lib/logout";
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
  LayoutGrid,
  LogOut,
  Settings,
  ShieldCheck,
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
];

/** Desktop: barra laterale completa, raggruppata. */
type MenuItem = { href: string; label: string; short?: string; icon: typeof House };

const groups: { label: string; items: MenuItem[] }[] = [
  {
    label: "Salone",
    items: [
      { href: "/admin", label: "Panoramica", icon: House },
      { href: "/admin/calendario", label: "Agenda", icon: CalendarDays },
      { href: "/admin/appuntamenti", label: "Nuovo appuntamento", short: "Nuovo", icon: CalendarPlus },
      { href: "/admin/clienti", label: "Clienti", icon: Users },
    ],
  },
  {
    label: "Gestione",
    items: [
      { href: "/admin/promozioni", label: "Promozioni", short: "Promo", icon: Tag },
      { href: "/admin/servizi", label: "Servizi", icon: Scissors },
      { href: "/admin/disponibilita", label: "Disponibilità", short: "Orari", icon: Ban },
      { href: "/admin/notifiche", label: "Notifiche", icon: Bell },
      { href: "/admin/impostazioni", label: "Impostazioni", short: "Opzioni", icon: Settings },
      { href: "/admin/amministratori", label: "Amministratori", short: "Admin", icon: ShieldCheck },
      { href: "/admin/configurazione", label: "Prima configurazione", short: "Configura", icon: ListChecks },
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
  const { count: unread } = useUnreadCount();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const inMenu = !tabs.some((item) => isCurrent(pathname, item.href));
  return (
    <div className="admin-frame">

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
      {menu ? (
        <>
          <button className="sheet-scrim" type="button" aria-label="Chiudi menu" onClick={() => setMenu(false)} />
          <div className="sheet-panel menu-sheet" role="dialog" aria-label="Menu">
            <div className="sheet-handle" />
            <div className="flex items-center justify-between">
              <h2>Menu</h2>
              <button className="icon-btn is-soft" style={{ width: 36, height: 36 }} type="button" aria-label="Chiudi" onClick={() => setMenu(false)}>
                <X size={18} />
              </button>
            </div>
            {groups.map((group) => (
              <div key={group.label} className="mt-3">
                <p className="eyebrow">{group.label}</p>
                <div className="menu-grid">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.href} href={item.href} className="menu-item" aria-current={isCurrent(pathname, item.href) ? "page" : undefined} onClick={() => setMenu(false)}>
                        <span className="tile-icon"><Icon size={20} /></span>
                        {item.label}
                        {item.href === "/admin/notifiche" ? <CountBadge count={unread} /> : null}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link className="btn btn-soft" href="/" onClick={() => setMenu(false)}>
                <House size={17} /> Sito clienti
              </Link>
              <button className="btn btn-danger" type="button" onClick={() => void logout()}>
                <LogOut size={17} /> Esci
              </button>
            </div>
          </div>
        </>
      ) : null}
      {/* Computer: barra in basso con tutte le voci. */}
      <nav className="tabbar admin-bar-desktop" aria-label="Menu amministratore">
        {groups.flatMap((group) => group.items).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined} className="relative" title={item.label}>
              <Icon size={21} strokeWidth={1.8} className={item.icon === House ? "tab-fill" : undefined} />
              {item.href === "/admin/notifiche" ? <CountBadge count={unread} className="on-tab" /> : null}
              <span>{item.short ?? item.label}</span>
            </Link>
          );
        })}
        <button type="button" className="tab-button" onClick={() => void logout()} title="Esci">
          <LogOut size={21} strokeWidth={1.8} />
          <span>Esci</span>
        </button>
      </nav>
      {/* Telefono: quattro voci principali + Menu con tutto il resto. */}
      <nav className="tabbar admin-bar-mobile" aria-label="Navigazione amministratore">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} aria-current={isCurrent(pathname, item.href) ? "page" : undefined} className="relative">
              <Icon size={23} strokeWidth={1.7} className={item.icon === House ? "tab-fill" : undefined} />
              {item.href === "/admin/notifiche" ? <CountBadge count={unread} className="on-tab" /> : null}
              {item.label}
            </Link>
          );
        })}
        <button type="button" className="tab-button" aria-current={inMenu || menu ? "page" : undefined} onClick={() => setMenu(true)}>
          <LayoutGrid size={23} strokeWidth={1.7} />
          Menu
        </button>
      </nav>
    </div>
  );
}
